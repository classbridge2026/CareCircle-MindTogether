import { randomUUID } from "node:crypto";
import type { CredentialType, PrismaClient } from "@prisma/client";
import { inspectCredentialFile, safeDownloadName } from "./credential-file";
import { CREDENTIAL_TYPES } from "@/lib/validation/doctor";
import { parseIsoDate } from "@/lib/validation/doctor";
import {
  canDeleteCredential,
  credentialDownloadDecision,
  credentialMutationAllowed,
  credentialStorageKey,
  credentialUploadFailureMessage,
} from "./rules";
import type { PrivateObjectStorage } from "@/lib/storage/private-storage";
import { STORAGE_CONFIGURATION_HINT } from "@/lib/storage/private-storage";
import { notifyAdministratorsOfDoctorReview, returnApprovedProfileToReview } from "./review-notice";

export async function uploadDoctorCredential(
  input: {
    actorUserId: string;
    type: string;
    filename: string;
    declaredMime: string;
    bytes: Uint8Array;
    expiresOn?: string | null;
  },
  deps: { db: PrismaClient; storage: PrivateObjectStorage; now: Date; logError?: (code: string) => void },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (!CREDENTIAL_TYPES.includes(input.type as (typeof CREDENTIAL_TYPES)[number])) {
    return { ok: false, message: "Choose a document type." };
  }
  const profile = await deps.db.doctorProfile.findUnique({
    where: { userId: input.actorUserId },
    include: { credentials: { where: { archivedAt: null }, select: { id: true, type: true, status: true, reviewedAt: true, storageKey: true } } },
  });
  if (!profile || profile.userId !== input.actorUserId) {
    return { ok: false, message: "Your doctor profile is not available." };
  }
  if (!credentialMutationAllowed(profile.verificationStatus)) {
    return { ok: false, message: "Documents cannot be changed while the profile is under review or suspended." };
  }
  const wasApproved = profile.verificationStatus === "APPROVED";
  const inspected = inspectCredentialFile({
    filename: input.filename,
    declaredMime: input.declaredMime,
    bytes: input.bytes,
  });
  if (!inspected.ok) {
    return { ok: false, message: inspected.message };
  }
  if (!deps.storage.configured) {
    return { ok: false, message: credentialUploadFailureMessage("not_configured") };
  }

  const credentialId = randomUUID();
  let storageKey: string;
  try {
    storageKey = credentialStorageKey(profile.id, credentialId);
  } catch {
    return { ok: false, message: credentialUploadFailureMessage("invalid") };
  }
  const stored = await deps.storage.put({ key: storageKey, body: input.bytes, mimeType: inspected.mimeType });
  if (!stored.ok) {
    return { ok: false, message: credentialUploadFailureMessage(stored.reason) };
  }

  const expiresOn = input.expiresOn ? parseIsoDate(input.expiresOn) : null;
  if (input.expiresOn && !expiresOn) {
    await deps.storage.remove(storageKey);
    return { ok: false, message: "Enter a valid expiry date or leave it blank." };
  }

  try {
    await deps.db.$transaction(async (tx) => {
      await tx.doctorCredential.create({
        data: {
          id: credentialId,
          doctorProfileId: profile.id,
          type: input.type as CredentialType,
          status: "PENDING",
          storageKey,
          originalFilename: inspected.originalFilename,
          mimeType: inspected.mimeType,
          sizeBytes: inspected.sizeBytes,
          checksumSha256: inspected.checksumSha256,
          expiresOn,
        },
      });
      await tx.medicalFile.create({
        data: {
          storageKey,
          originalFilename: inspected.originalFilename,
          mimeType: inspected.mimeType,
          sizeBytes: inspected.sizeBytes,
          checksumSha256: inspected.checksumSha256,
          purpose: "CREDENTIAL",
          uploaderUserId: input.actorUserId,
          doctorCredentialId: credentialId,
        },
      });
      const previous = profile.credentials.filter((item) => item.type === input.type);
      for (const item of previous) {
        await tx.doctorCredential.update({
          where: { id: item.id },
          data: { archivedAt: deps.now, replacedByCredentialId: credentialId },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: previous.length ? "doctor.credential.replaced" : "doctor.credential.uploaded",
          entityType: "DoctorCredential",
          entityId: credentialId,
          metadata: { type: input.type, replaced: previous.length },
        },
      });
      if (wasApproved) {
        await returnApprovedProfileToReview(tx, {
          doctorProfileId: profile.id,
          actorUserId: input.actorUserId,
          now: deps.now,
        });
      }
    });
  } catch {
    await deps.storage.remove(storageKey);
    deps.logError?.("credential_record_failed");
    return { ok: false, message: "The document was not stored because the record could not be saved." };
  }

  for (const item of profile.credentials.filter((entry) => entry.type === input.type && entry.status === "PENDING" && !entry.reviewedAt)) {
    const removed = await deps.storage.remove(item.storageKey);
    if (!removed.ok) {
      deps.logError?.("credential_storage_delete_failed");
    }
  }

  if (wasApproved) {
    await notifyAdministratorsOfDoctorReview(deps.db, {
      doctorProfileId: profile.id,
      doctorName: profile.fullName,
      actorUserId: input.actorUserId,
    });
  }

  return {
    ok: true,
    message: wasApproved
      ? "The document was stored privately and the profile was sent for administrator verification."
      : "The document was stored privately and is waiting for review.",
  };
}

export async function deleteDoctorCredential(
  credentialId: string,
  deps: { db: PrismaClient; storage: PrivateObjectStorage; actorUserId: string; logError?: (code: string) => void },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const credential = await deps.db.doctorCredential.findUnique({
    where: { id: credentialId },
    include: { doctor: { select: { userId: true, verificationStatus: true, fullName: true } } },
  });
  if (!credential) {
    return { ok: false, message: "That document was not found." };
  }
  if (!credentialMutationAllowed(credential.doctor.verificationStatus)) {
    return { ok: false, message: "Documents cannot be changed while the profile is under review or suspended." };
  }
  const wasApproved = credential.doctor.verificationStatus === "APPROVED";
  const decision = canDeleteCredential({
    owner: credential.doctor.userId === deps.actorUserId,
    status: credential.status,
    reviewedAt: credential.reviewedAt,
    archivedAt: credential.archivedAt,
  });
  if (!decision.allowed) {
    return { ok: false, message: decision.message };
  }
  if (!deps.storage.configured) {
    return { ok: false, message: credentialUploadFailureMessage("not_configured") };
  }
  const removed = await deps.storage.remove(credential.storageKey);
  if (!removed.ok) {
    return { ok: false, message: "The document was not removed because private storage did not accept the deletion." };
  }
  try {
    await deps.db.$transaction(async (tx) => {
      await tx.medicalFile.deleteMany({ where: { doctorCredentialId: credential.id } });
      await tx.doctorCredential.delete({ where: { id: credential.id } });
      await tx.auditLog.create({
        data: {
          actorUserId: deps.actorUserId,
          action: "doctor.credential.deleted",
          entityType: "DoctorProfile",
          entityId: credential.doctorProfileId,
          metadata: { type: credential.type },
        },
      });
      if (wasApproved) {
        await returnApprovedProfileToReview(tx, {
          doctorProfileId: credential.doctorProfileId,
          actorUserId: deps.actorUserId,
          now: new Date(),
        });
      }
    });
  } catch {
    deps.logError?.("credential_delete_failed");
    return { ok: false, message: "The document file was removed, but the record could not be deleted. Contact an administrator." };
  }
  if (wasApproved) {
    await notifyAdministratorsOfDoctorReview(deps.db, {
      doctorProfileId: credential.doctorProfileId,
      doctorName: credential.doctor.fullName,
      actorUserId: deps.actorUserId,
    });
  }
  return {
    ok: true,
    message: wasApproved
      ? "The unreviewed document was removed and the profile was sent for administrator verification."
      : "The unreviewed document was removed.",
  };
}

export async function openCredentialFile(
  credentialId: string,
  actor: { userId: string | null; status: string | null; roleCodes: string[] },
  deps: { db: PrismaClient; storage: PrivateObjectStorage },
): Promise<
  | { ok: true; body: Uint8Array; mimeType: string; filename: string }
  | { ok: false; status: 401 | 403 | 404 | 503; message: string }
> {
  const credential = await deps.db.doctorCredential.findUnique({
    where: { id: credentialId },
    include: { doctor: { select: { userId: true } } },
  });
  if (!credential) {
    return { ok: false, status: 404, message: "This document is not available." };
  }
  const decision = credentialDownloadDecision({
    actorUserId: actor.userId,
    actorStatus: actor.status,
    actorRoles: actor.roleCodes,
    doctorUserId: credential.doctor.userId,
  });
  if (decision === "unauthenticated") {
    return { ok: false, status: 401, message: "Sign in to download this document." };
  }
  if (decision === "forbidden") {
    return { ok: false, status: 403, message: "You cannot download this document." };
  }
  if (!deps.storage.configured) {
    return { ok: false, status: 503, message: STORAGE_CONFIGURATION_HINT };
  }
  const file = await deps.storage.read(credential.storageKey);
  if (!file.ok) {
    return { ok: false, status: 404, message: "This document is not available." };
  }
  const extension = credential.mimeType === "application/pdf" ? "pdf" : credential.mimeType === "image/png" ? "png" : "jpg";
  return {
    ok: true,
    body: file.body,
    mimeType: credential.mimeType,
    filename: safeDownloadName(credential.originalFilename, extension),
  };
}
