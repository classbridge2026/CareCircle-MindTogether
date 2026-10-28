import type { Prisma, PrismaClient } from "@prisma/client";
import {
  DATA_PROCESSING_DOCUMENT_VERSION,
  GUARDIAN_AUTHORIZATION_DOCUMENT_VERSION,
  PRIVACY_DOCUMENT_VERSION,
  TELEHEALTH_DOCUMENT_VERSION,
  TERMS_DOCUMENT_VERSION,
} from "@/lib/auth/constants";
import { isSchemaMismatch, isUniqueConflict } from "@/lib/doctors/errors";
import { clinicalAuditMetadata } from "./rules";

export const MANAGED_CONSENT_TYPES = ["PRIVACY_NOTICE", "DATA_PROCESSING", "TELEHEALTH", "GUARDIAN_AUTHORIZATION"] as const;
export type ManagedConsentType = (typeof MANAGED_CONSENT_TYPES)[number];

const CURRENT_VERSION: Record<ManagedConsentType, string> = {
  PRIVACY_NOTICE: PRIVACY_DOCUMENT_VERSION,
  DATA_PROCESSING: DATA_PROCESSING_DOCUMENT_VERSION,
  TELEHEALTH: TELEHEALTH_DOCUMENT_VERSION,
  GUARDIAN_AUTHORIZATION: GUARDIAN_AUTHORIZATION_DOCUMENT_VERSION,
};

export function isManagedConsentType(value: string): value is ManagedConsentType {
  return (MANAGED_CONSENT_TYPES as readonly string[]).includes(value);
}

export function consentVersion(type: ManagedConsentType): string {
  return CURRENT_VERSION[type];
}

export function consentLabel(type: string): string {
  switch (type) {
    case "PRIVACY_NOTICE":
      return "Privacy notice";
    case "DATA_PROCESSING":
      return "Data processing";
    case "TELEHEALTH":
      return "Telehealth";
    case "GUARDIAN_AUTHORIZATION":
      return "Guardian authorization";
    case "TERMS_OF_USE":
      return "Terms of use";
    default:
      return type;
  }
}

function active(row: { withdrawnAt: Date | null; expiresAt: Date | null }, now: Date): boolean {
  return row.withdrawnAt === null && (row.expiresAt === null || row.expiresAt > now);
}

export async function listOwnConsents(db: PrismaClient, userId: string, now = new Date()) {
  try {
    const rows = await db.consentRecord.findMany({
      where: { userId },
      orderBy: { acceptedAt: "desc" },
      select: {
        id: true,
        consentType: true,
        documentVersion: true,
        acceptedAt: true,
        withdrawnAt: true,
        expiresAt: true,
        evidenceRef: true,
      },
    });
    return {
      ok: true as const,
      consents: rows.map((row) => ({
        id: row.id,
        type: row.consentType,
        label: consentLabel(row.consentType),
        version: row.documentVersion,
        currentVersion: isManagedConsentType(row.consentType) ? CURRENT_VERSION[row.consentType] : row.documentVersion,
        manageable: isManagedConsentType(row.consentType),
        active: active(row, now),
        acceptedAt: row.acceptedAt,
        withdrawnAt: row.withdrawnAt,
        expiresAt: row.expiresAt,
        evidenceRef: row.evidenceRef,
      })),
      termsVersion: TERMS_DOCUMENT_VERSION,
    };
  } catch (error) {
    return { ok: false as const, code: isSchemaMismatch(error) ? ("SCHEMA" as const) : ("UNAVAILABLE" as const) };
  }
}

async function auditConsent(
  tx: Prisma.TransactionClient,
  input: { userId: string; consentId: string; action: string; consentType: string; documentVersion: string },
) {
  await tx.auditLog.create({
    data: {
      actorUserId: input.userId,
      action: input.action,
      entityType: "ConsentRecord",
      entityId: input.consentId,
      metadata: clinicalAuditMetadata({ consentType: input.consentType, documentVersion: input.documentVersion }),
    },
  });
}

export async function withdrawOwnConsent(
  db: PrismaClient,
  input: { userId: string; consentType: string; now?: Date },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (!isManagedConsentType(input.consentType)) {
    return { ok: false, message: "That consent cannot be changed from this page." };
  }
  const consentType = input.consentType;
  const now = input.now ?? new Date();
  try {
    const rows = await db.consentRecord.findMany({
      where: { userId: input.userId, consentType },
      select: { id: true, withdrawnAt: true, expiresAt: true, documentVersion: true },
    });
    const current = rows.find((row) => active(row, now));
    if (!current) return { ok: false, message: "There is no current consent of that type to withdraw." };
    await db.$transaction(async (tx) => {
      const updated = await tx.consentRecord.updateMany({
        where: { id: current.id, userId: input.userId, withdrawnAt: null },
        data: { withdrawnAt: now },
      });
      if (updated.count !== 1) throw new Error("CONSENT_CHANGED");
      await auditConsent(tx, {
        userId: input.userId,
        consentId: current.id,
        action: "consent.withdrawn",
        consentType,
        documentVersion: current.documentVersion,
      });
    });
    return { ok: true, message: "The consent was withdrawn. It no longer authorizes new clinical records that require it." };
  } catch (error) {
    if (error instanceof Error && error.message === "CONSENT_CHANGED") {
      return { ok: false, message: "That consent changed before it could be withdrawn. Refresh and try again." };
    }
    if (isSchemaMismatch(error)) return { ok: false, message: "Consent records are not available until the latest database migration has been applied." };
    return { ok: false, message: "The consent could not be withdrawn." };
  }
}

export async function grantOwnConsent(
  db: PrismaClient,
  input: { userId: string; consentType: string; now?: Date },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (!isManagedConsentType(input.consentType)) {
    return { ok: false, message: "That consent cannot be changed from this page." };
  }
  const consentType = input.consentType;
  const now = input.now ?? new Date();
  const version = CURRENT_VERSION[consentType];
  try {
    const existing = await db.consentRecord.findUnique({
      where: { userId_consentType_documentVersion: { userId: input.userId, consentType, documentVersion: version } },
      select: { id: true, withdrawnAt: true, expiresAt: true },
    });
    if (existing && active(existing, now)) return { ok: true, message: "That consent is already current." };
    await db.$transaction(async (tx) => {
      if (existing) {
        await tx.consentRecord.update({
          where: { id: existing.id },
          data: { withdrawnAt: null, acceptedAt: now, expiresAt: null },
        });
        await auditConsent(tx, {
          userId: input.userId,
          consentId: existing.id,
          action: "consent.granted",
          consentType,
          documentVersion: version,
        });
        return;
      }
      const created = await tx.consentRecord.create({
        data: { userId: input.userId, consentType, documentVersion: version, acceptedAt: now },
        select: { id: true },
      });
      await auditConsent(tx, {
        userId: input.userId,
        consentId: created.id,
        action: "consent.granted",
        consentType,
        documentVersion: version,
      });
    });
    return { ok: true, message: "The consent was recorded for the current version." };
  } catch (error) {
    if (isUniqueConflict(error)) return { ok: true, message: "That consent is already recorded." };
    if (isSchemaMismatch(error)) return { ok: false, message: "Consent records are not available until the latest database migration has been applied." };
    return { ok: false, message: "The consent could not be recorded." };
  }
}
