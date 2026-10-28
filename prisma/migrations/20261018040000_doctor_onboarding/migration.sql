-- Doctor onboarding, invitations, and specialty verification.
-- Review required. Do not apply until the schema change is approved.
-- PSYCHIATRY is already seeded by the initial migration and is not inserted again.
-- fullName is copied from displayName when that name is present.
-- If a profile has no display name, the NOT NULL step fails closed.

CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'SUPERSEDED');

CREATE TYPE "InvitationDeliveryStatus" AS ENUM ('NOT_SENT', 'SENT', 'FAILED');

CREATE TYPE "SpecialtyClaimStatus" AS ENUM ('DECLARED', 'VERIFIED', 'REJECTED');

CREATE TYPE "QualificationKind" AS ENUM ('MEDICAL_DEGREE', 'PROFESSIONAL_DIPLOMA', 'SPECIALIST_QUALIFICATION', 'BOARD_CERTIFICATION', 'OTHER');

ALTER TABLE "DoctorProfile" ADD COLUMN "fullName" TEXT;
ALTER TABLE "DoctorProfile" ADD COLUMN "qualificationKind" "QualificationKind";
ALTER TABLE "DoctorProfile" ADD COLUMN "qualificationTitle" TEXT;
ALTER TABLE "DoctorProfile" ADD COLUMN "qualificationInstitution" TEXT;
ALTER TABLE "DoctorProfile" ADD COLUMN "qualificationYear" INTEGER;
ALTER TABLE "DoctorProfile" ADD COLUMN "licenseExpiresOn" DATE;
ALTER TABLE "DoctorProfile" ADD COLUMN "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "DoctorProfile" ADD COLUMN "consultationModes" "ConsultationMode"[] NOT NULL DEFAULT ARRAY[]::"ConsultationMode"[];
ALTER TABLE "DoctorProfile" ADD COLUMN "correctionNotes" TEXT;
ALTER TABLE "DoctorProfile" ADD COLUMN "returnedAt" TIMESTAMPTZ(6);
ALTER TABLE "DoctorProfile" ADD COLUMN "suspensionReason" TEXT;

UPDATE "DoctorProfile"
SET "fullName" = "displayName"
WHERE "fullName" IS NULL
  AND "displayName" <> '';

ALTER TABLE "DoctorProfile" ALTER COLUMN "fullName" SET NOT NULL;

ALTER TABLE "DoctorCredential" ADD COLUMN "archivedAt" TIMESTAMPTZ(6);
ALTER TABLE "DoctorCredential" ADD COLUMN "replacedByCredentialId" UUID;

CREATE UNIQUE INDEX "DoctorCredential_replacedByCredentialId_key" ON "DoctorCredential"("replacedByCredentialId");
CREATE INDEX "DoctorCredential_archivedAt_idx" ON "DoctorCredential"("archivedAt");

ALTER TABLE "DoctorCredential"
ADD CONSTRAINT "DoctorCredential_replacedByCredentialId_fkey"
FOREIGN KEY ("replacedByCredentialId") REFERENCES "DoctorCredential"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DoctorSpecialty" ADD COLUMN "claimStatus" "SpecialtyClaimStatus" NOT NULL DEFAULT 'DECLARED';
ALTER TABLE "DoctorSpecialty" ADD COLUMN "verifiedAt" TIMESTAMPTZ(6);
ALTER TABLE "DoctorSpecialty" ADD COLUMN "verifiedByUserId" UUID;

CREATE INDEX "DoctorSpecialty_claimStatus_idx" ON "DoctorSpecialty"("claimStatus");

ALTER TABLE "DoctorSpecialty"
ADD CONSTRAINT "DoctorSpecialty_verifiedByUserId_fkey"
FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DoctorInvitation" (
    "id" UUID NOT NULL,
    "doctorProfileId" UUID NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryStatus" "InvitationDeliveryStatus" NOT NULL DEFAULT 'NOT_SENT',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DoctorInvitation_tokenHash_key" ON "DoctorInvitation"("tokenHash");
CREATE INDEX "DoctorInvitation_doctorProfileId_status_idx" ON "DoctorInvitation"("doctorProfileId", "status");
CREATE INDEX "DoctorInvitation_emailNormalized_status_idx" ON "DoctorInvitation"("emailNormalized", "status");
CREATE INDEX "DoctorInvitation_expiresAt_idx" ON "DoctorInvitation"("expiresAt");

-- One outstanding invitation per doctor and per email. Historical rows stay.
CREATE UNIQUE INDEX "DoctorInvitation_one_pending_email_idx"
ON "DoctorInvitation" ("emailNormalized")
WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "DoctorInvitation_one_pending_doctor_idx"
ON "DoctorInvitation" ("doctorProfileId")
WHERE "status" = 'PENDING';

ALTER TABLE "DoctorInvitation"
ADD CONSTRAINT "DoctorInvitation_doctorProfileId_fkey"
FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DoctorInvitation"
ADD CONSTRAINT "DoctorInvitation_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DoctorVerificationEvent" (
    "id" UUID NOT NULL,
    "doctorProfileId" UUID NOT NULL,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "fromStatus" "DoctorVerificationStatus",
    "toStatus" "DoctorVerificationStatus" NOT NULL,
    "reason" TEXT,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorVerificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DoctorVerificationEvent_doctorProfileId_occurredAt_idx" ON "DoctorVerificationEvent"("doctorProfileId", "occurredAt");
CREATE INDEX "DoctorVerificationEvent_actorUserId_idx" ON "DoctorVerificationEvent"("actorUserId");

ALTER TABLE "DoctorVerificationEvent"
ADD CONSTRAINT "DoctorVerificationEvent_doctorProfileId_fkey"
FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DoctorVerificationEvent"
ADD CONSTRAINT "DoctorVerificationEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
