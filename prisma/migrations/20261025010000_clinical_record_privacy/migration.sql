-- Phase 8 clinical record privacy. Additive only.
-- Existing encounters, notes, files, and consent rows are kept.
-- AuditLog, RecordAccessLog, ClinicalNoteVersion, and SummaryRelease reject UPDATE and DELETE.
-- A database owner can disable those triggers. The application role is not given a separate privilege set here
-- because the Neon role name is an operational setting and is not stored in this migration.

CREATE TYPE "EncounterStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ClinicalNoteState" AS ENUM ('DRAFT', 'FINALIZED');
CREATE TYPE "SummaryReleaseEvent" AS ENUM ('RELEASED', 'WITHDRAWN');
CREATE TYPE "RecordAccessOutcome" AS ENUM ('ALLOWED', 'DENIED');
CREATE TYPE "ClinicalScanStatus" AS ENUM ('NOT_CONFIGURED', 'CLEAN', 'REJECTED', 'FAILED');

ALTER TABLE "ConsentRecord" ADD COLUMN "expiresAt" TIMESTAMPTZ(6);
ALTER TABLE "ConsentRecord" ADD COLUMN "evidenceRef" TEXT;
CREATE INDEX "ConsentRecord_expiresAt_idx" ON "ConsentRecord"("expiresAt");

ALTER TABLE "GuardianRelationship" ADD COLUMN "expiresAt" TIMESTAMPTZ(6);

ALTER TABLE "Encounter" ADD COLUMN "status" "EncounterStatus" NOT NULL DEFAULT 'IN_PROGRESS';
CREATE INDEX "Encounter_status_idx" ON "Encounter"("status");

UPDATE "Encounter" AS encounter
SET
  "status" = 'CANCELLED',
  "endedAt" = COALESCE(encounter."endedAt", appointment."cancelledAt", CURRENT_TIMESTAMP)
FROM "Appointment" AS appointment
WHERE appointment.id = encounter."appointmentId"
  AND appointment.status IN ('CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR', 'CANCELLED_BY_ADMIN', 'NO_SHOW');

UPDATE "Encounter" AS encounter
SET "status" = 'COMPLETED'
FROM "Appointment" AS appointment
WHERE appointment.id = encounter."appointmentId"
  AND appointment.status = 'COMPLETED'
  AND encounter.status <> 'CANCELLED';

ALTER TABLE "ClinicalNote" ADD COLUMN "state" "ClinicalNoteState" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "ClinicalNote" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ClinicalNote" ADD COLUMN "finalizedAt" TIMESTAMPTZ(6);
CREATE INDEX "ClinicalNote_state_idx" ON "ClinicalNote"("state");

ALTER TABLE "ClinicalNote"
  ADD CONSTRAINT "ClinicalNote_revision_positive" CHECK ("revision" >= 1);

ALTER TABLE "ClinicalNote"
  ADD CONSTRAINT "ClinicalNote_working_note_unreleased"
  CHECK ("kind" <> 'PRIVATE_WORKING' OR "summaryReleaseStatus" = 'NOT_RELEASED');

ALTER TABLE "ClinicalNoteVersion" ADD COLUMN "encounterId" UUID;
ALTER TABLE "ClinicalNoteVersion" ADD COLUMN "amendmentReason" TEXT;

UPDATE "ClinicalNoteVersion" AS version
SET "encounterId" = note."encounterId"
FROM "ClinicalNote" AS note
WHERE note.id = version."clinicalNoteId"
  AND version."encounterId" IS NULL;

ALTER TABLE "ClinicalNoteVersion" ALTER COLUMN "encounterId" SET NOT NULL;

ALTER TABLE "ClinicalNoteVersion"
  ADD CONSTRAINT "ClinicalNoteVersion_encounterId_fkey"
  FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ClinicalNoteVersion_encounterId_idx" ON "ClinicalNoteVersion"("encounterId");

CREATE TABLE "SummaryRelease" (
  "id" UUID NOT NULL,
  "clinicalNoteId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "patientProfileId" UUID NOT NULL,
  "encounterId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "event" "SummaryReleaseEvent" NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SummaryRelease_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SummaryRelease_clinicalNoteId_occurredAt_idx" ON "SummaryRelease"("clinicalNoteId", "occurredAt");
CREATE INDEX "SummaryRelease_patientProfileId_occurredAt_idx" ON "SummaryRelease"("patientProfileId", "occurredAt");
CREATE INDEX "SummaryRelease_encounterId_idx" ON "SummaryRelease"("encounterId");
CREATE INDEX "SummaryRelease_actorUserId_idx" ON "SummaryRelease"("actorUserId");

ALTER TABLE "SummaryRelease"
  ADD CONSTRAINT "SummaryRelease_clinicalNoteId_fkey"
  FOREIGN KEY ("clinicalNoteId") REFERENCES "ClinicalNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SummaryRelease"
  ADD CONSTRAINT "SummaryRelease_patientProfileId_fkey"
  FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SummaryRelease"
  ADD CONSTRAINT "SummaryRelease_encounterId_fkey"
  FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SummaryRelease"
  ADD CONSTRAINT "SummaryRelease_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "SummaryRelease" (
  "id", "clinicalNoteId", "version", "patientProfileId", "encounterId", "actorUserId", "event", "occurredAt"
)
SELECT
  gen_random_uuid(),
  note.id,
  GREATEST(note.revision, 1),
  encounter."patientProfileId",
  note."encounterId",
  COALESCE(note."releasedByUserId", doctor."userId"),
  'RELEASED',
  COALESCE(note."releasedAt", note."updatedAt")
FROM "ClinicalNote" AS note
JOIN "Encounter" AS encounter ON encounter.id = note."encounterId"
JOIN "DoctorProfile" AS doctor ON doctor.id = note."authorDoctorProfileId"
WHERE note.kind = 'PATIENT_SUMMARY'
  AND note."summaryReleaseStatus" IN ('RELEASED', 'WITHDRAWN');

INSERT INTO "SummaryRelease" (
  "id", "clinicalNoteId", "version", "patientProfileId", "encounterId", "actorUserId", "event", "occurredAt"
)
SELECT
  gen_random_uuid(),
  note.id,
  GREATEST(note.revision, 1),
  encounter."patientProfileId",
  note."encounterId",
  COALESCE(note."releasedByUserId", doctor."userId"),
  'WITHDRAWN',
  note."updatedAt"
FROM "ClinicalNote" AS note
JOIN "Encounter" AS encounter ON encounter.id = note."encounterId"
JOIN "DoctorProfile" AS doctor ON doctor.id = note."authorDoctorProfileId"
WHERE note.kind = 'PATIENT_SUMMARY'
  AND note."summaryReleaseStatus" = 'WITHDRAWN';

ALTER TABLE "RecordAccessLog" ADD COLUMN "outcome" "RecordAccessOutcome" NOT NULL DEFAULT 'ALLOWED';
ALTER TABLE "RecordAccessLog" ADD COLUMN "reason" TEXT;
CREATE INDEX "RecordAccessLog_outcome_occurredAt_idx" ON "RecordAccessLog"("outcome", "occurredAt");

ALTER TABLE "MedicalFile" ADD COLUMN "patientVisible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MedicalFile" ADD COLUMN "scanStatus" "ClinicalScanStatus" NOT NULL DEFAULT 'NOT_CONFIGURED';
ALTER TABLE "MedicalFile" ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MedicalFile" ADD COLUMN "deletedAt" TIMESTAMPTZ(6);

ALTER TABLE "MedicalFile"
  ADD CONSTRAINT "MedicalFile_visible_requires_note"
  CHECK ("patientVisible" = false OR "clinicalNoteId" IS NOT NULL);

CREATE INDEX "MedicalFile_clinicalNoteId_idx" ON "MedicalFile"("clinicalNoteId");
CREATE INDEX "MedicalFile_patientProfileId_patientVisible_idx" ON "MedicalFile"("patientProfileId", "patientVisible");

UPDATE "MedicalFile" AS file
SET "patientVisible" = true
FROM "ClinicalNote" AS note
WHERE file."clinicalNoteId" = note.id
  AND file.purpose = 'CLINICAL_ATTACHMENT'
  AND file."deletedAt" IS NULL
  AND note.kind = 'PATIENT_SUMMARY'
  AND note."summaryReleaseStatus" = 'RELEASED'
  AND note."archivedAt" IS NULL;

CREATE OR REPLACE FUNCTION reject_append_only_clinical_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'append-only clinical record cannot be changed';
END;
$$;

CREATE TRIGGER "AuditLog_append_only"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION reject_append_only_clinical_mutation();

CREATE TRIGGER "RecordAccessLog_append_only"
BEFORE UPDATE OR DELETE ON "RecordAccessLog"
FOR EACH ROW EXECUTE FUNCTION reject_append_only_clinical_mutation();

CREATE TRIGGER "ClinicalNoteVersion_append_only"
BEFORE UPDATE OR DELETE ON "ClinicalNoteVersion"
FOR EACH ROW EXECUTE FUNCTION reject_append_only_clinical_mutation();

CREATE TRIGGER "SummaryRelease_append_only"
BEFORE UPDATE OR DELETE ON "SummaryRelease"
FOR EACH ROW EXECUTE FUNCTION reject_append_only_clinical_mutation();
