import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { DOCTOR_ROLE_CODE } from "@/lib/auth/constants";
import type { DeliveryResult } from "@/lib/auth/delivery";
import { createEmailToken } from "@/lib/auth/tokens";
import { addDoctorSchema, fieldErrorsFromZod, type DoctorField } from "@/lib/validation/doctor";
import { DOCTOR_INVITATION_TTL_MS } from "./constants";
import { loadSystemName } from "@/lib/brand/system-name";
import { doctorInvitationText } from "./invitation-email";
import { DoctorFlowError, isUniqueConflict } from "./errors";
import { invitationOutcomeMessage, isAdministrator } from "./rules";

export type CreateDoctorResult =
  | { ok: true; doctorProfileId: string; emailSent: boolean; message: string }
  | { ok: false; formMessage?: string; fieldErrors?: Partial<Record<DoctorField, string>> };

export type InvitationDelivery = (input: {
  to: string;
  subject: string;
  text: string;
  systemName?: string;
}) => Promise<DeliveryResult>;

export async function createDoctorAccount(
  input: unknown,
  deps: {
    db: PrismaClient;
    actor: { userId: string; roleCodes: string[] };
    hashPassword: (password: string) => Promise<string>;
    deliver: InvitationDelivery;
    now: Date;
    appBaseUrl: string | null;
    logError?: (code: string) => void;
  },
): Promise<CreateDoctorResult> {
  if (!isAdministrator(deps.actor.roleCodes)) {
    return { ok: false, formMessage: "Only an administrator can add a doctor." };
  }

  const parsed = addDoctorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const data = parsed.data;

  let passwordHash: string;
  try {
    passwordHash = await deps.hashPassword(randomBytes(48).toString("base64url"));
  } catch {
    deps.logError?.("password_hash_failed");
    return { ok: false, formMessage: "The doctor account could not be created because the password could not be prepared. Try again." };
  }

  const token = createEmailToken();
  const expiresAt = new Date(deps.now.getTime() + DOCTOR_INVITATION_TTL_MS);

  let created: {
    userId: string;
    profileId: string;
    invitationId: string;
    email: string;
    fullName: string;
    expiresAt: Date;
    tokenRaw: string;
  };
  try {
    created = await deps.db.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { code: DOCTOR_ROLE_CODE } });
      if (!role) {
        throw new DoctorFlowError("DOCTOR_ROLE_MISSING");
      }
      const specialty = await tx.specialty.findUnique({ where: { id: data.specialtyId } });
      if (!specialty || !specialty.isActive) {
        throw new DoctorFlowError("SPECIALTY_UNAVAILABLE");
      }
      const emailOwner = await tx.user.findUnique({ where: { emailNormalized: data.emailNormalized } });
      if (emailOwner) {
        throw new DoctorFlowError("EMAIL_IN_USE");
      }
      const phoneOwner = await tx.user.findUnique({ where: { phoneE164: data.phoneE164 } });
      if (phoneOwner) {
        throw new DoctorFlowError("PHONE_IN_USE");
      }
      const openInvite = await tx.doctorInvitation.findFirst({
        where: { emailNormalized: data.emailNormalized, status: "PENDING", expiresAt: { gt: deps.now } },
      });
      if (openInvite) {
        throw new DoctorFlowError("INVITE_OPEN");
      }

      const user = await tx.user.create({
        data: {
          email: data.email,
          emailNormalized: data.emailNormalized,
          phoneE164: data.phoneE164,
          passwordHash,
          status: "PENDING_VERIFICATION",
        },
      });
      await tx.userRole.create({
        data: { userId: user.id, roleId: role.id, grantedBy: deps.actor.userId },
      });
      const profile = await tx.doctorProfile.create({
        data: {
          userId: user.id,
          fullName: data.fullName,
          displayName: data.fullName,
          biography: data.biography,
          qualificationTitle: data.qualificationTitle,
          yearsExperience: data.yearsExperience,
          verificationStatus: "DRAFT",
        },
      });
      await tx.doctorSpecialty.create({
        data: {
          doctorProfileId: profile.id,
          specialtyId: specialty.id,
          isPrimary: true,
          claimStatus: "DECLARED",
        },
      });
      const invitation = await tx.doctorInvitation.create({
        data: {
          doctorProfileId: profile.id,
          emailNormalized: data.emailNormalized,
          tokenHash: token.hash,
          status: "PENDING",
          deliveryStatus: "NOT_SENT",
          expiresAt,
          createdByUserId: deps.actor.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: deps.actor.userId,
          action: "doctor.created",
          entityType: "DoctorProfile",
          entityId: profile.id,
          metadata: { role: DOCTOR_ROLE_CODE },
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: deps.actor.userId,
          action: "doctor.invitation.created",
          entityType: "DoctorInvitation",
          entityId: invitation.id,
          metadata: { delivery: "pending" },
        },
      });
      return {
        userId: user.id,
        profileId: profile.id,
        invitationId: invitation.id,
        email: data.email,
        fullName: data.fullName,
        expiresAt,
        tokenRaw: token.raw,
      };
    }, {
      maxWait: 10_000,
      timeout: 20_000,
    });
  } catch (error) {
    const code = error instanceof DoctorFlowError ? error.code : isUniqueConflict(error) ? "DUPLICATE" : "";
    if (code === "EMAIL_IN_USE" || code === "DUPLICATE") {
      return { ok: false, formMessage: "An account or invitation already uses this email address." };
    }
    if (code === "PHONE_IN_USE") {
      return { ok: false, formMessage: "An account already uses this phone number." };
    }
    if (code === "INVITE_OPEN") {
      return { ok: false, formMessage: "An invitation is already outstanding for this email address." };
    }
    if (code === "SPECIALTY_UNAVAILABLE") {
      return { ok: false, fieldErrors: { specialtyId: "Choose an active specialty." } };
    }
    if (code === "DOCTOR_ROLE_MISSING") {
      return { ok: false, formMessage: "Doctor accounts are not available until the doctor role exists." };
    }
    deps.logError?.("doctor_create_failed");
    return { ok: false, formMessage: "The doctor account could not be created. Try again." };
  }

  const baseUrlMissing = !deps.appBaseUrl;
  const systemName = await loadSystemName(deps.db);
  let delivery: DeliveryResult = { delivered: false, reason: "not_configured" };
  if (!baseUrlMissing) {
    const inviteUrl = `${deps.appBaseUrl}/doctor/invitation?token=${encodeURIComponent(created.tokenRaw)}`;
    const message = doctorInvitationText({
      doctorName: created.fullName,
      inviteUrl,
      expiresAt: created.expiresAt,
      systemName,
    });
    try {
      delivery = await deps.deliver({ to: created.email, subject: message.subject, text: message.text, systemName });
    } catch {
      delivery = { delivered: false, reason: "provider_failed" };
      deps.logError?.("doctor_invitation_delivery_failed");
    }
  }

  const deliveryStatus = delivery.delivered ? "SENT" : delivery.reason === "provider_failed" ? "FAILED" : "NOT_SENT";
  try {
    await deps.db.doctorInvitation.update({
      where: { id: created.invitationId },
      data: { deliveryStatus },
    });
    await deps.db.auditLog.create({
      data: {
        actorUserId: deps.actor.userId,
        action: delivery.delivered ? "doctor.invitation.sent" : "doctor.invitation.failed",
        entityType: "DoctorInvitation",
        entityId: created.invitationId,
        metadata: { delivery: delivery.reason },
      },
    });
    await deps.db.notification.create({
      data: {
        recipientId: created.userId,
        channel: "EMAIL",
        type: "doctor.invitation",
        title: "Doctor invitation",
        preview: delivery.delivered
          ? `An invitation to join ${systemName} was sent.`
          : "An invitation email could not be sent.",
        entityType: "DoctorInvitation",
        entityId: created.invitationId,
        status: delivery.delivered ? "SENT" : "FAILED",
      },
    });
  } catch {
    deps.logError?.("invitation_status_update_failed");
  }

  const outcome = invitationOutcomeMessage({
    delivered: delivery.delivered,
    reason: delivery.reason,
    baseUrlMissing,
  });
  return {
    ok: true,
    doctorProfileId: created.profileId,
    emailSent: outcome.emailSent,
    message: outcome.message,
  };
}
