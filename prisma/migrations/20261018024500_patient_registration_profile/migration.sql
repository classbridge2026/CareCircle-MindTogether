-- Patient registration profile fields.
-- Review required. Do not apply until the schema change is approved.
-- This file does not seed patients. If PatientProfile already has rows,
-- the NOT NULL steps fail closed instead of inventing names or genders.

CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY');

ALTER TABLE "PatientProfile" ADD COLUMN "fullName" TEXT;
ALTER TABLE "PatientProfile" ADD COLUMN "gender" "Gender";
ALTER TABLE "PatientProfile" ADD COLUMN "nationality" TEXT;
ALTER TABLE "PatientProfile" ADD COLUMN "residentialAddress" TEXT;

ALTER TABLE "PatientProfile" ALTER COLUMN "fullName" SET NOT NULL;
ALTER TABLE "PatientProfile" ALTER COLUMN "gender" SET NOT NULL;
