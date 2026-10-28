import type { PrismaClient } from "@prisma/client";
import {
  consentState,
  GUARDIAN_RELEASED_RECORD_SETTING,
  guardianMayReadReleasedSummary,
  utcDateOnly,
} from "./rules";

const dependentSelect = {
  id: true,
  userId: true,
  isDependent: true,
  dateOfBirth: true,
  archivedAt: true,
} as const;

export async function guardianMayAccessPatient(
  db: PrismaClient,
  input: { actorUserId: string; patientProfileId: string; now?: Date },
): Promise<boolean> {
  const ids = await authorizedGuardianPatientIds(db, input.actorUserId, input.now ?? new Date());
  return ids.includes(input.patientProfileId);
}

export async function authorizedGuardianPatientIds(db: PrismaClient, actorUserId: string, now = new Date()): Promise<string[]> {
  const setting = await db.platformSetting.findUnique({
    where: { key: GUARDIAN_RELEASED_RECORD_SETTING },
    select: { valueJson: true },
  });
  if (setting?.valueJson !== true) return [];
  const [relationships, consents] = await Promise.all([
    db.guardianRelationship.findMany({
      where: { guardianUserId: actorUserId, status: "AUTHORIZED", revokedAt: null },
      select: {
        status: true,
        revokedAt: true,
        expiresAt: true,
        dependent: { select: dependentSelect },
      },
    }),
    db.consentRecord.findMany({
      where: { userId: actorUserId, consentType: "GUARDIAN_AUTHORIZATION" },
      select: { withdrawnAt: true, expiresAt: true },
    }),
  ]);
  const guardianConsent = consentState(consents, now);
  return relationships
    .filter((row) =>
      guardianMayReadReleasedSummary({
        policyEnabled: true,
        relationshipStatus: row.status,
        revokedAt: row.revokedAt,
        expiresAt: row.expiresAt,
        guardianConsent,
        isDependent: row.dependent.isDependent,
        dateOfBirth: utcDateOnly(row.dependent.dateOfBirth),
        patientArchived: row.dependent.archivedAt !== null,
        now,
      }),
    )
    .map((row) => row.dependent.id);
}
