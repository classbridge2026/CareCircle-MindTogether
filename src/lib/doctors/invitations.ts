import type { PrismaClient } from "@prisma/client";
import { passwordRuleError } from "@/lib/auth/password-reset";
import { sessionExpiry } from "@/lib/auth/session";
import { createEmailToken, hashEmailToken, hashSessionToken } from "@/lib/auth/tokens";
import type { DeliveryResult } from "@/lib/auth/delivery";
import type { RateLimiter } from "@/lib/auth/rate-limit";
import { DOCTOR_INVITATION_TTL_MS, INVITE_INVALID } from "./constants";
import { DoctorFlowError } from "./errors";
import { loadSystemName } from "@/lib/brand/system-name";
import { doctorInvitationText } from "./invitation-email";
import { invitationTokenState, isAdministrator, resendOutcomeMessage } from "./rules";

function messageForState(state: ReturnType<typeof invitationTokenState>): string {
  switch (state) {
    case "expired":
      return "This invitation has expired. Ask an administrator to send a new one.";
    case "used":
      return "This invitation has already been used.";
    case "revoked":
      return "This invitation was revoked. Ask an administrator if you still need access.";
    case "replaced":
      return "This invitation was replaced. Use the link in the latest email.";
    default:
      return INVITE_INVALID;
  }
}

export async function inspectDoctorInvitation(db: PrismaClient, token: string, now: Date) {
  const raw = token.trim();
  if (!raw) {
    return { ok: false as const, message: INVITE_INVALID };
  }
  const record = await db.doctorInvitation.findUnique({
    where: { tokenHash: hashEmailToken(raw) },
    include: { doctor: { select: { fullName: true } } },
  });
  const state = invitationTokenState(
    record
      ? {
          status: record.status,
          expiresAt: record.expiresAt,
          acceptedAt: record.acceptedAt,
          revokedAt: record.revokedAt,
        }
      : null,
    now,
  );
  if (!record || state !== "valid") {
    return { ok: false as const, message: messageForState(state) };
  }
  return { ok: true as const, doctorName: record.doctor.fullName, expiresAt: record.expiresAt };
}

export async function acceptDoctorInvitation(
  input: { token: string; password: string; confirmPassword: string },
  deps: {
    db: PrismaClient;
    hashPassword: (password: string) => Promise<string>;
    now: Date;
    rateLimiter: RateLimiter;
    rateKey: string;
    userAgent?: string | null;
    ipAddressHash?: string | null;
    logError?: (code: string) => void;
  },
): Promise<{ ok: true; sessionToken: string } | { ok: false; formMessage: string }> {
  const rate = deps.rateLimiter.check(deps.rateKey);
  if (!rate.allowed) {
    return { ok: false, formMessage: "Too many attempts. Wait before trying again." };
  }
  if (!input.password) {
    return { ok: false, formMessage: "Enter a password." };
  }
  const ruleError = passwordRuleError(input.password);
  if (ruleError) {
    return { ok: false, formMessage: ruleError };
  }
  if (input.password !== input.confirmPassword) {
    return { ok: false, formMessage: "Passwords do not match." };
  }

  const raw = input.token.trim();
  if (!raw) {
    return { ok: false, formMessage: INVITE_INVALID };
  }
  const record = await deps.db.doctorInvitation.findUnique({
    where: { tokenHash: hashEmailToken(raw) },
    include: { doctor: { select: { userId: true } } },
  });
  const state = invitationTokenState(
    record
      ? {
          status: record.status,
          expiresAt: record.expiresAt,
          acceptedAt: record.acceptedAt,
          revokedAt: record.revokedAt,
        }
      : null,
    deps.now,
  );
  if (!record || state !== "valid") {
    return { ok: false, formMessage: messageForState(state) };
  }

  let passwordHash: string;
  try {
    passwordHash = await deps.hashPassword(input.password);
  } catch {
    deps.logError?.("password_hash_failed");
    return { ok: false, formMessage: "The invitation could not be accepted. Try again." };
  }
  const sessionToken = createEmailToken().raw;

  try {
    await deps.db.$transaction(async (tx) => {
      const updated = await tx.doctorInvitation.updateMany({
        where: {
          id: record.id,
          status: "PENDING",
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: deps.now },
        },
        data: { status: "ACCEPTED", acceptedAt: deps.now },
      });
      if (updated.count !== 1) {
        throw new DoctorFlowError("INVITE_INVALID");
      }
      await tx.user.update({
        where: { id: record.doctor.userId },
        data: {
          passwordHash,
          status: "ACTIVE",
          emailVerifiedAt: deps.now,
        },
      });
      await tx.session.create({
        data: {
          userId: record.doctor.userId,
          tokenHash: hashSessionToken(sessionToken),
          expiresAt: sessionExpiry(deps.now),
          userAgent: deps.userAgent ?? null,
          ipAddressHash: deps.ipAddressHash ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: record.doctor.userId,
          action: "doctor.invitation.accepted",
          entityType: "DoctorInvitation",
          entityId: record.id,
          metadata: { role: "DOCTOR" },
        },
      });
    });
  } catch (error) {
    if (error instanceof DoctorFlowError) {
      return { ok: false, formMessage: INVITE_INVALID };
    }
    deps.logError?.("invitation_accept_failed");
    return { ok: false, formMessage: "The invitation could not be accepted. Try again." };
  }

  return { ok: true, sessionToken };
}

export async function resendDoctorInvitation(
  input: { invitationId: string },
  deps: {
    db: PrismaClient;
    actor: { userId: string; roleCodes: string[] };
    deliver: (input: { to: string; subject: string; text: string; systemName?: string }) => Promise<DeliveryResult>;
    now: Date;
    appBaseUrl: string | null;
    rateLimiter: RateLimiter;
    rateKey: string;
    logError?: (code: string) => void;
  },
): Promise<{ ok: true; emailSent: boolean; message: string } | { ok: false; message: string }> {
  if (!isAdministrator(deps.actor.roleCodes)) {
    return { ok: false, message: "Only an administrator can resend an invitation." };
  }
  const rate = deps.rateLimiter.check(deps.rateKey);
  if (!rate.allowed) {
    return { ok: false, message: "Too many resend attempts. Wait before trying again." };
  }

  const existing = await deps.db.doctorInvitation.findUnique({
    where: { id: input.invitationId },
    include: { doctor: { select: { id: true, fullName: true, user: { select: { id: true, email: true } } } } },
  });
  if (!existing || existing.status !== "PENDING") {
    return { ok: false, message: "Only an outstanding invitation can be resent." };
  }

  const token = createEmailToken();
  const expiresAt = new Date(deps.now.getTime() + DOCTOR_INVITATION_TTL_MS);
  let invitationId = "";
  try {
    invitationId = await deps.db.$transaction(async (tx) => {
      const superseded = await tx.doctorInvitation.updateMany({
        where: { id: existing.id, status: "PENDING" },
        data: { status: "SUPERSEDED" },
      });
      if (superseded.count !== 1) {
        throw new DoctorFlowError("INVITE_NOT_PENDING");
      }
      const created = await tx.doctorInvitation.create({
        data: {
          doctorProfileId: existing.doctorProfileId,
          emailNormalized: existing.emailNormalized,
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
          action: "doctor.invitation.resent",
          entityType: "DoctorInvitation",
          entityId: created.id,
          metadata: { replacedInvitationId: existing.id },
        },
      });
      return created.id;
    });
  } catch {
    return { ok: false, message: "The invitation could not be replaced. Try again." };
  }

  const baseUrlMissing = !deps.appBaseUrl;
  const systemName = await loadSystemName(deps.db);
  let delivery: DeliveryResult = { delivered: false, reason: "not_configured" };
  if (!baseUrlMissing) {
    const inviteUrl = `${deps.appBaseUrl}/doctor/invitation?token=${encodeURIComponent(token.raw)}`;
    const message = doctorInvitationText({
      doctorName: existing.doctor.fullName,
      inviteUrl,
      expiresAt,
      systemName,
    });
    try {
      delivery = await deps.deliver({ to: existing.doctor.user.email, subject: message.subject, text: message.text, systemName });
    } catch {
      delivery = { delivered: false, reason: "provider_failed" };
      deps.logError?.("doctor_invitation_delivery_failed");
    }
  }

  try {
    await deps.db.doctorInvitation.update({
      where: { id: invitationId },
      data: { deliveryStatus: delivery.delivered ? "SENT" : delivery.reason === "provider_failed" ? "FAILED" : "NOT_SENT" },
    });
    await deps.db.notification.create({
      data: {
        recipientId: existing.doctor.user.id,
        channel: "EMAIL",
        type: "doctor.invitation",
        title: "Doctor invitation",
        preview: delivery.delivered
          ? "A replacement invitation was sent."
          : "A replacement invitation email could not be sent.",
        entityType: "DoctorInvitation",
        entityId: invitationId,
        status: delivery.delivered ? "SENT" : "FAILED",
      },
    });
  } catch {
    deps.logError?.("invitation_status_update_failed");
  }

  return {
    ok: true,
    emailSent: delivery.delivered,
    message: resendOutcomeMessage({
      delivered: delivery.delivered,
      reason: delivery.reason,
      baseUrlMissing,
    }),
  };
}

export async function revokeDoctorInvitation(
  input: { invitationId: string },
  deps: { db: PrismaClient; actor: { userId: string; roleCodes: string[] }; now: Date },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (!isAdministrator(deps.actor.roleCodes)) {
    return { ok: false, message: "Only an administrator can revoke an invitation." };
  }
  const updated = await deps.db.doctorInvitation.updateMany({
    where: { id: input.invitationId, status: "PENDING" },
    data: { status: "REVOKED", revokedAt: deps.now },
  });
  if (updated.count !== 1) {
    return { ok: false, message: "Only an outstanding invitation can be revoked." };
  }
  await deps.db.auditLog.create({
    data: {
      actorUserId: deps.actor.userId,
      action: "doctor.invitation.revoked",
      entityType: "DoctorInvitation",
      entityId: input.invitationId,
    },
  });
  return { ok: true, message: "The invitation was revoked. The link can no longer be used." };
}
