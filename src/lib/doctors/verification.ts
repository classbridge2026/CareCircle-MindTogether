import type { CredentialReviewStatus, PrismaClient } from "@prisma/client";
import { approvalBlockers, canVerifySpecialty, isAdministrator, type ProfileFields } from "./rules";
import { identityDocumentRequired, toFields } from "./profile";
import { notifyDoctorOfDecision } from "./review-notice";

type Actor = { userId: string; roleCodes: string[] };

const OPEN_APPOINTMENT_STATUSES = ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] as const;

async function loadDecisionProfile(db: PrismaClient, doctorProfileId: string) {
  return db.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    include: {
      user: { select: { id: true, status: true, email: true } },
      credentials: { select: { type: true, status: true, archivedAt: true } },
      specialties: { select: { id: true, specialtyId: true, isPrimary: true, claimStatus: true } },
    },
  });
}

function fieldsOf(profile: NonNullable<Awaited<ReturnType<typeof loadDecisionProfile>>>): ProfileFields {
  return toFields({
    ...profile,
    user: { email: profile.user.email, phoneE164: null },
  });
}

export async function approveDoctor(
  doctorProfileId: string,
  deps: { db: PrismaClient; actor: Actor; now: Date },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const profile = await loadDecisionProfile(deps.db, doctorProfileId);
  if (!profile) {
    return { ok: false, message: "That doctor profile was not found." };
  }
  const identityRequired = await identityDocumentRequired(deps.db);
  const phoneProfile = await deps.db.user.findUnique({
    where: { id: profile.userId },
    select: { phoneE164: true, email: true },
  });
  const blockers = approvalBlockers({
    actorUserId: deps.actor.userId,
    actorRoles: deps.actor.roleCodes,
    doctorUserId: profile.userId,
    verificationStatus: profile.verificationStatus,
    profile: {
      ...fieldsOf(profile),
      phoneE164: phoneProfile?.phoneE164 ?? null,
      email: phoneProfile?.email ?? profile.user.email,
    },
    credentials: profile.credentials,
    identityRequired,
    primaryClaim: profile.specialties.find((item) => item.isPrimary)?.claimStatus ?? null,
  });
  if (blockers.length > 0) {
    return { ok: false, message: blockers[0] ?? "This application cannot be approved." };
  }

  await deps.db.$transaction(async (tx) => {
    const current = await tx.doctorProfile.findUnique({ where: { id: profile.id } });
    if (!current || (current.verificationStatus !== "SUBMITTED" && current.verificationStatus !== "UNDER_REVIEW")) {
      throw new Error("NOT_READY");
    }
    await tx.doctorProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: "APPROVED",
        verifiedAt: deps.now,
        rejectionReason: null,
        correctionNotes: null,
      },
    });
    await tx.doctorVerificationEvent.create({
      data: {
        doctorProfileId: profile.id,
        actorUserId: deps.actor.userId,
        action: "approved",
        fromStatus: current.verificationStatus,
        toStatus: "APPROVED",
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: deps.actor.userId,
        action: "doctor.verification.approved",
        entityType: "DoctorProfile",
        entityId: profile.id,
      },
    });
  });

  await notifyDoctorOfDecision(deps.db, { userId: profile.userId, approved: true });
  return { ok: true, message: "The doctor was approved. They can receive new consultations only while the account stays active." };
}

export async function rejectDoctor(
  doctorProfileId: string,
  reason: string,
  deps: { db: PrismaClient; actor: Actor; now: Date },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const trimmed = reason.trim();
  if (trimmed.length < 8) {
    return { ok: false, message: "Enter a rejection reason of at least 8 characters." };
  }
  if (!isAdministrator(deps.actor.roleCodes)) {
    return { ok: false, message: "Only an administrator can reject a doctor." };
  }
  const profile = await deps.db.doctorProfile.findUnique({ where: { id: doctorProfileId } });
  if (!profile) {
    return { ok: false, message: "That doctor profile was not found." };
  }
  if (profile.userId === deps.actor.userId) {
    return { ok: false, message: "A doctor cannot reject their own profile." };
  }
  if (profile.verificationStatus !== "SUBMITTED" && profile.verificationStatus !== "UNDER_REVIEW") {
    return { ok: false, message: "Only a submitted application can be rejected." };
  }

  await deps.db.$transaction(async (tx) => {
    await tx.doctorProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: "REJECTED",
        rejectedAt: deps.now,
        rejectionReason: trimmed,
      },
    });
    await tx.doctorVerificationEvent.create({
      data: {
        doctorProfileId: profile.id,
        actorUserId: deps.actor.userId,
        action: "rejected",
        fromStatus: profile.verificationStatus,
        toStatus: "REJECTED",
        reason: trimmed,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: deps.actor.userId,
        action: "doctor.verification.rejected",
        entityType: "DoctorProfile",
        entityId: profile.id,
        metadata: { reason: trimmed },
      },
    });
  });
  await notifyDoctorOfDecision(deps.db, { userId: profile.userId, approved: false });
  return { ok: true, message: "The application was rejected. The doctor is not active for consultations." };
}

export async function returnDoctorForCorrections(
  doctorProfileId: string,
  notes: string,
  deps: { db: PrismaClient; actor: Actor; now: Date },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const trimmed = notes.trim();
  if (trimmed.length < 8) {
    return { ok: false, message: "Explain what the doctor needs to correct." };
  }
  if (!isAdministrator(deps.actor.roleCodes)) {
    return { ok: false, message: "Only an administrator can return an application." };
  }
  const profile = await deps.db.doctorProfile.findUnique({ where: { id: doctorProfileId } });
  if (!profile || profile.userId === deps.actor.userId) {
    return { ok: false, message: "This application cannot be returned." };
  }
  if (profile.verificationStatus !== "SUBMITTED" && profile.verificationStatus !== "UNDER_REVIEW") {
    return { ok: false, message: "Only a submitted application can be returned for corrections." };
  }
  await deps.db.$transaction(async (tx) => {
    await tx.doctorProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: "DRAFT",
        correctionNotes: trimmed,
        returnedAt: deps.now,
      },
    });
    await tx.doctorVerificationEvent.create({
      data: {
        doctorProfileId: profile.id,
        actorUserId: deps.actor.userId,
        action: "returned",
        fromStatus: profile.verificationStatus,
        toStatus: "DRAFT",
        reason: trimmed,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: deps.actor.userId,
        action: "doctor.verification.returned",
        entityType: "DoctorProfile",
        entityId: profile.id,
        metadata: { reason: trimmed },
      },
    });
  });
  return { ok: true, message: "The application was returned for corrections. It is not approved." };
}

export async function suspendDoctor(
  doctorProfileId: string,
  reason: string,
  deps: { db: PrismaClient; actor: Actor; now: Date },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const trimmed = reason.trim();
  if (trimmed.length < 8) {
    return { ok: false, message: "Enter a suspension reason of at least 8 characters." };
  }
  if (!isAdministrator(deps.actor.roleCodes)) {
    return { ok: false, message: "Only an administrator can suspend a doctor." };
  }
  const profile = await deps.db.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    include: { user: { select: { status: true } } },
  });
  if (!profile) {
    return { ok: false, message: "That doctor profile was not found." };
  }
  if (profile.userId === deps.actor.userId) {
    return { ok: false, message: "A doctor cannot suspend their own account." };
  }
  if (profile.verificationStatus !== "APPROVED" || profile.user.status !== "ACTIVE") {
    return { ok: false, message: "Only an approved, active doctor can be suspended." };
  }

  await deps.db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: profile.userId }, data: { status: "SUSPENDED" } });
    await tx.doctorProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: "SUSPENDED",
        suspendedAt: deps.now,
        suspensionReason: trimmed,
      },
    });
    await tx.doctorVerificationEvent.create({
      data: {
        doctorProfileId: profile.id,
        actorUserId: deps.actor.userId,
        action: "suspended",
        fromStatus: "APPROVED",
        toStatus: "SUSPENDED",
        reason: trimmed,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: deps.actor.userId,
        action: "doctor.suspended",
        entityType: "DoctorProfile",
        entityId: profile.id,
        metadata: { reason: trimmed },
      },
    });
  });
  return {
    ok: true,
    message: "The doctor was suspended. Existing appointments were kept and are listed on this profile for resolution.",
  };
}

export async function reactivateDoctor(
  doctorProfileId: string,
  deps: { db: PrismaClient; actor: Actor; now: Date },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (!isAdministrator(deps.actor.roleCodes)) {
    return { ok: false, message: "Only an administrator can reactivate a doctor." };
  }
  const profile = await deps.db.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    include: { user: { select: { status: true } } },
  });
  if (!profile || profile.userId === deps.actor.userId) {
    return { ok: false, message: "This doctor cannot be reactivated." };
  }
  if (profile.verificationStatus !== "SUSPENDED" || profile.user.status !== "SUSPENDED") {
    return { ok: false, message: "Only a suspended doctor can be reactivated." };
  }
  await deps.db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: profile.userId }, data: { status: "ACTIVE" } });
    await tx.doctorProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: "APPROVED",
        suspendedAt: null,
      },
    });
    await tx.doctorVerificationEvent.create({
      data: {
        doctorProfileId: profile.id,
        actorUserId: deps.actor.userId,
        action: "reactivated",
        fromStatus: "SUSPENDED",
        toStatus: "APPROVED",
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: deps.actor.userId,
        action: "doctor.reactivated",
        entityType: "DoctorProfile",
        entityId: profile.id,
      },
    });
  });
  return { ok: true, message: "The doctor was reactivated and can receive new consultations again." };
}

export async function reviewCredential(
  credentialId: string,
  decision: "VERIFIED" | "REJECTED",
  notes: string,
  deps: { db: PrismaClient; actor: Actor; now: Date },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const trimmed = notes.trim();
  if (decision === "REJECTED" && trimmed.length < 8) {
    return { ok: false, message: "Enter a reason of at least 8 characters when rejecting a document." };
  }
  if (!isAdministrator(deps.actor.roleCodes)) {
    return { ok: false, message: "Only an administrator can review a credential." };
  }
  const credential = await deps.db.doctorCredential.findUnique({
    where: { id: credentialId },
    include: { doctor: { select: { id: true, userId: true, verificationStatus: true } } },
  });
  if (!credential || credential.archivedAt) {
    return { ok: false, message: "That document is not available for review." };
  }
  if (credential.doctor.userId === deps.actor.userId) {
    return { ok: false, message: "A doctor cannot review their own credential." };
  }

  const status: CredentialReviewStatus = decision;
  await deps.db.$transaction(async (tx) => {
    await tx.doctorCredential.update({
      where: { id: credential.id },
      data: {
        status,
        reviewedAt: deps.now,
        reviewedByUserId: deps.actor.userId,
        reviewNotes: trimmed || null,
      },
    });
    if (credential.doctor.verificationStatus === "SUBMITTED") {
      await tx.doctorProfile.update({
        where: { id: credential.doctor.id },
        data: { verificationStatus: "UNDER_REVIEW" },
      });
      await tx.doctorVerificationEvent.create({
        data: {
          doctorProfileId: credential.doctor.id,
          actorUserId: deps.actor.userId,
          action: "under_review",
          fromStatus: "SUBMITTED",
          toStatus: "UNDER_REVIEW",
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: deps.actor.userId,
        action: "doctor.credential.reviewed",
        entityType: "DoctorCredential",
        entityId: credential.id,
        metadata: { decision, reason: trimmed || null },
      },
    });
  });
  return {
    ok: true,
    message: decision === "VERIFIED" ? "The document was marked verified." : "The document was rejected.",
  };
}

export async function verifyDoctorSpecialty(
  doctorSpecialtyId: string,
  deps: { db: PrismaClient; actor: Actor; now: Date },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const link = await deps.db.doctorSpecialty.findUnique({
    where: { id: doctorSpecialtyId },
    include: {
      doctor: {
        select: {
          userId: true,
          credentials: { where: { archivedAt: null, status: "VERIFIED" }, select: { id: true } },
        },
      },
      specialty: { select: { name: true } },
    },
  });
  if (!link) {
    return { ok: false, message: "That specialty claim was not found." };
  }
  const blocked = canVerifySpecialty({
    actorUserId: deps.actor.userId,
    actorRoles: deps.actor.roleCodes,
    doctorUserId: link.doctor.userId,
    verifiedCredentialCount: link.doctor.credentials.length,
  });
  if (blocked) {
    return { ok: false, message: blocked };
  }
  await deps.db.doctorSpecialty.update({
    where: { id: link.id },
    data: {
      claimStatus: "VERIFIED",
      verifiedAt: deps.now,
      verifiedByUserId: deps.actor.userId,
    },
  });
  await deps.db.auditLog.create({
    data: {
      actorUserId: deps.actor.userId,
      action: "doctor.specialty.verified",
      entityType: "DoctorSpecialty",
      entityId: link.id,
      metadata: { specialty: link.specialty.name },
    },
  });
  return { ok: true, message: `${link.specialty.name} is now a verified specialty.` };
}

function reviewNote(note: string): string | null {
  const trimmed = note.trim();
  if (trimmed.length < 8 || trimmed.length > 500) return null;
  return trimmed;
}

export async function completeDoctorProfile(
  doctorProfileId: string,
  note: string,
  deps: { db: PrismaClient; actor: Actor; now: Date },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const trimmed = reviewNote(note);
  if (!trimmed) return { ok: false, message: "Enter a review note of 8 to 500 characters to complete this profile." };
  if (!isAdministrator(deps.actor.roleCodes)) return { ok: false, message: "Only an administrator can verify a doctor." };
  const profile = await deps.db.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    select: {
      id: true,
      userId: true,
      verificationStatus: true,
      user: { select: { status: true, deletedAt: true } },
      specialties: {
        select: {
          id: true,
          isPrimary: true,
          claimStatus: true,
          specialty: { select: { name: true, isActive: true } },
        },
      },
    },
  });
  if (!profile || profile.user.deletedAt) return { ok: false, message: "That doctor profile was not found." };
  if (profile.userId === deps.actor.userId) return { ok: false, message: "You cannot verify your own profile." };
  if (profile.verificationStatus === "SUSPENDED" || profile.user.status === "SUSPENDED") {
    return { ok: false, message: "Reactivate this suspended doctor before verifying the profile." };
  }
  if (profile.user.status === "DISABLED") return { ok: false, message: "This account is closed, so patients cannot see this doctor." };
  const primary = profile.specialties.find((item) => item.isPrimary && item.specialty.isActive) ?? profile.specialties.find((item) => item.specialty.isActive);
  if (!primary) return { ok: false, message: "Add an active specialty before verifying this profile." };
  const alreadyVisible = profile.verificationStatus === "APPROVED" && profile.user.status === "ACTIVE" && primary.claimStatus === "VERIFIED";
  if (alreadyVisible) return { ok: false, message: "Patients can already see this doctor." };

  await deps.db.$transaction(
    async (tx) => {
      if (profile.user.status === "PENDING_VERIFICATION") {
        await tx.user.update({ where: { id: profile.userId }, data: { status: "ACTIVE" } });
      }
      if (!primary.isPrimary) {
        await tx.doctorSpecialty.updateMany({ where: { doctorProfileId: profile.id, isPrimary: true }, data: { isPrimary: false } });
      }
      await tx.doctorSpecialty.update({
        where: { id: primary.id },
        data: { isPrimary: true, claimStatus: "VERIFIED", verifiedAt: deps.now, verifiedByUserId: deps.actor.userId },
      });
      await tx.doctorProfile.update({
        where: { id: profile.id },
        data: {
          verificationStatus: "APPROVED",
          verifiedAt: deps.now,
          rejectionReason: null,
          correctionNotes: null,
        },
      });
      await tx.doctorVerificationEvent.create({
        data: {
          doctorProfileId: profile.id,
          actorUserId: deps.actor.userId,
          action: "profile_completed",
          fromStatus: profile.verificationStatus,
          toStatus: "APPROVED",
          reason: trimmed,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: deps.actor.userId,
          action: "doctor.verification.completed",
          entityType: "DoctorProfile",
          entityId: profile.id,
          metadata: { reason: trimmed, specialty: primary.specialty.name },
        },
      });
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
  return {
    ok: true,
    message: `${primary.specialty.name} is verified and the profile is approved. Patients can see this doctor while the account stays active.`,
  };
}

export async function unverifyDoctorProfile(
  doctorProfileId: string,
  note: string,
  deps: { db: PrismaClient; actor: Actor; now: Date },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const trimmed = reviewNote(note);
  if (!trimmed) return { ok: false, message: "Enter a reason of 8 to 500 characters to mark this profile incomplete." };
  if (!isAdministrator(deps.actor.roleCodes)) return { ok: false, message: "Only an administrator can unverify a doctor." };
  const profile = await deps.db.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    select: { id: true, userId: true, verificationStatus: true, user: { select: { deletedAt: true } } },
  });
  if (!profile || profile.user.deletedAt) return { ok: false, message: "That doctor profile was not found." };
  if (profile.userId === deps.actor.userId) return { ok: false, message: "You cannot unverify your own profile." };
  if (profile.verificationStatus !== "APPROVED") return { ok: false, message: "Only a verified profile can be marked incomplete." };

  await deps.db.$transaction(
    async (tx) => {
      await tx.doctorSpecialty.updateMany({
        where: { doctorProfileId: profile.id, claimStatus: "VERIFIED" },
        data: { claimStatus: "DECLARED", verifiedAt: null, verifiedByUserId: null },
      });
      await tx.doctorProfile.update({
        where: { id: profile.id },
        data: { verificationStatus: "DRAFT", verifiedAt: null },
      });
      await tx.doctorVerificationEvent.create({
        data: {
          doctorProfileId: profile.id,
          actorUserId: deps.actor.userId,
          action: "profile_unverified",
          fromStatus: "APPROVED",
          toStatus: "DRAFT",
          reason: trimmed,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: deps.actor.userId,
          action: "doctor.verification.unverified",
          entityType: "DoctorProfile",
          entityId: profile.id,
          metadata: { reason: trimmed },
        },
      });
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
  return { ok: true, message: "The profile is incomplete again. Patients can no longer see this doctor until it is verified." };
}

export async function listOpenAppointments(db: PrismaClient, doctorProfileId: string) {
  return db.appointment.findMany({
    where: { doctorProfileId, status: { in: [...OPEN_APPOINTMENT_STATUSES] } },
    select: { id: true, status: true, startsAt: true, mode: true },
    orderBy: { startsAt: "asc" },
    take: 50,
  });
}
