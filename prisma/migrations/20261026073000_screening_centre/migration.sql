-- Mental Health Screening Centre.
-- This migration does not drop visit-questionnaire tables or their rows.
-- Candidate instruments are registered inactive. No question text or scoring rule is inserted.

CREATE TYPE "ScreeningCategory" AS ENUM ('DEPRESSION', 'BIPOLAR', 'MANIA', 'ANXIETY', 'PSYCHOSIS', 'COGNITIVE', 'SUBSTANCE', 'OCD', 'PERSONALITY');
CREATE TYPE "ScreeningLicenseStatus" AS ENUM ('NOT_REVIEWED', 'RESTRICTION_UNRESOLVED', 'CLEARED_FOR_CLINICAL_USE', 'PROHIBITED');
CREATE TYPE "ScreeningApprovalState" AS ENUM ('PENDING_CLINICAL_REVIEW', 'CLINICALLY_APPROVED', 'REJECTED', 'RETIRED');
CREATE TYPE "ScreeningAvailability" AS ENUM ('INACTIVE', 'ACTIVE', 'RETIRED');
CREATE TYPE "ScreeningAssessmentState" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

CREATE TABLE "ScreeningTool" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "category" "ScreeningCategory" NOT NULL,
    "purpose" TEXT NOT NULL,
    "intendedPopulation" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "expectedMinutes" INTEGER NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "licenseStatus" "ScreeningLicenseStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "approvalState" "ScreeningApprovalState" NOT NULL DEFAULT 'PENDING_CLINICAL_REVIEW',
    "availability" "ScreeningAvailability" NOT NULL DEFAULT 'INACTIVE',
    "safetyProtocolRequired" BOOLEAN NOT NULL DEFAULT true,
    "safetyProtocolApproved" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMPTZ(6),
    "retiredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "ScreeningTool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningToolVersion" (
    "id" UUID NOT NULL,
    "toolId" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "scoringAlgorithmVersion" TEXT,
    "items" JSONB NOT NULL,
    "scoringSpec" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScreeningToolVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningConsent" (
    "id" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6) NOT NULL,
    "withdrawnAt" TIMESTAMPTZ(6),
    CONSTRAINT "ScreeningConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningAssessment" (
    "id" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "consentId" UUID NOT NULL,
    "state" "ScreeningAssessmentState" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMPTZ(6),
    "itemSnapshot" JSONB,
    CONSTRAINT "ScreeningAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningAssessmentAnswer" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "itemIndex" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    CONSTRAINT "ScreeningAssessmentAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningAssessmentResult" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "band" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "safetyFlag" BOOLEAN NOT NULL DEFAULT false,
    "calculatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScreeningAssessmentResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningClinicalReview" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "doctorProfileId" UUID NOT NULL,
    "interpretation" TEXT NOT NULL,
    "followUpNote" TEXT,
    "reviewedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScreeningClinicalReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningAmendment" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "editorUserId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScreeningAmendment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScreeningTool_code_key" ON "ScreeningTool"("code");
CREATE INDEX "ScreeningTool_category_idx" ON "ScreeningTool"("category");
CREATE INDEX "ScreeningTool_availability_idx" ON "ScreeningTool"("availability");
CREATE INDEX "ScreeningTool_approvalState_idx" ON "ScreeningTool"("approvalState");
CREATE UNIQUE INDEX "ScreeningToolVersion_toolId_version_key" ON "ScreeningToolVersion"("toolId", "version");
CREATE INDEX "ScreeningConsent_patientProfileId_acceptedAt_idx" ON "ScreeningConsent"("patientProfileId", "acceptedAt");
CREATE INDEX "ScreeningAssessment_patientProfileId_startedAt_idx" ON "ScreeningAssessment"("patientProfileId", "startedAt");
CREATE INDEX "ScreeningAssessment_versionId_idx" ON "ScreeningAssessment"("versionId");
CREATE INDEX "ScreeningAssessment_state_idx" ON "ScreeningAssessment"("state");
CREATE UNIQUE INDEX "ScreeningAssessmentAnswer_assessmentId_itemIndex_key" ON "ScreeningAssessmentAnswer"("assessmentId", "itemIndex");
CREATE UNIQUE INDEX "ScreeningAssessmentResult_assessmentId_key" ON "ScreeningAssessmentResult"("assessmentId");
CREATE INDEX "ScreeningClinicalReview_assessmentId_reviewedAt_idx" ON "ScreeningClinicalReview"("assessmentId", "reviewedAt");
CREATE INDEX "ScreeningClinicalReview_doctorProfileId_idx" ON "ScreeningClinicalReview"("doctorProfileId");
CREATE INDEX "ScreeningAmendment_assessmentId_createdAt_idx" ON "ScreeningAmendment"("assessmentId", "createdAt");
CREATE INDEX "ScreeningAmendment_editorUserId_idx" ON "ScreeningAmendment"("editorUserId");

ALTER TABLE "ScreeningToolVersion" ADD CONSTRAINT "ScreeningToolVersion_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "ScreeningTool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScreeningConsent" ADD CONSTRAINT "ScreeningConsent_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScreeningAssessment" ADD CONSTRAINT "ScreeningAssessment_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScreeningAssessment" ADD CONSTRAINT "ScreeningAssessment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScreeningToolVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScreeningAssessment" ADD CONSTRAINT "ScreeningAssessment_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "ScreeningConsent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScreeningAssessmentAnswer" ADD CONSTRAINT "ScreeningAssessmentAnswer_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ScreeningAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningAssessmentResult" ADD CONSTRAINT "ScreeningAssessmentResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ScreeningAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScreeningClinicalReview" ADD CONSTRAINT "ScreeningClinicalReview_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ScreeningAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScreeningClinicalReview" ADD CONSTRAINT "ScreeningClinicalReview_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScreeningAmendment" ADD CONSTRAINT "ScreeningAmendment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ScreeningAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScreeningAmendment" ADD CONSTRAINT "ScreeningAmendment_editorUserId_fkey" FOREIGN KEY ("editorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ScreeningTool" (
    "id", "code", "name", "abbreviation", "category", "purpose", "intendedPopulation", "instructions",
    "language", "expectedMinutes", "sourceReference", "licenseStatus", "approvalState", "availability",
    "safetyProtocolRequired", "safetyProtocolApproved", "updatedAt"
) VALUES
    ('11111111-1111-4111-8111-111111111001', 'PHQ9', 'Depression screening candidate', 'PHQ-9', 'DEPRESSION', 'A candidate depression screen for adults. It is not a diagnosis.', 'Adults, after clinical and licensing approval.', 'Questions are withheld until the clinical lead approves a licensed version.', 'en', 5, 'PHQ-9. Reproduction requires a recorded license and clinical approval.', 'NOT_REVIEWED', 'PENDING_CLINICAL_REVIEW', 'INACTIVE', true, false, CURRENT_TIMESTAMP),
    ('11111111-1111-4111-8111-111111111002', 'MDQ', 'Bipolar disorder screening candidate', 'MDQ', 'BIPOLAR', 'A candidate mood-disorder screen. It is not a diagnosis of bipolar disorder.', 'Adults, after clinical and licensing approval.', 'Questions are withheld until the clinical lead approves a licensed version.', 'en', 5, 'Mood Disorder Questionnaire. Confirm licensing before reproduction.', 'NOT_REVIEWED', 'PENDING_CLINICAL_REVIEW', 'INACTIVE', true, false, CURRENT_TIMESTAMP),
    ('11111111-1111-4111-8111-111111111003', 'ASRM', 'Mania screening candidate', 'ASRM', 'MANIA', 'A candidate mania screen. It is not a diagnosis.', 'Adults, after clinical and licensing approval.', 'Questions are withheld until the clinical lead approves a licensed version.', 'en', 5, 'Altman Self-Rating Mania Scale. Confirm licensing before reproduction.', 'NOT_REVIEWED', 'PENDING_CLINICAL_REVIEW', 'INACTIVE', true, false, CURRENT_TIMESTAMP),
    ('11111111-1111-4111-8111-111111111004', 'GAD7', 'Anxiety screening candidate', 'GAD-7', 'ANXIETY', 'A candidate anxiety screen. It is not a diagnosis.', 'Adults, after clinical and licensing approval.', 'Questions are withheld until the clinical lead approves a licensed version.', 'en', 5, 'GAD-7. Reproduction requires a recorded license and clinical approval.', 'NOT_REVIEWED', 'PENDING_CLINICAL_REVIEW', 'INACTIVE', true, false, CURRENT_TIMESTAMP),
    ('11111111-1111-4111-8111-111111111005', 'PSYCHOSIS', 'Psychosis-related screening candidate', 'Pending', 'PSYCHOSIS', 'Reserved for a clinically approved psychosis screen for the intended population. No instrument is active.', 'To be defined by the clinical lead.', 'No questionnaire is available.', 'en', 10, 'Select a validated instrument and record licensing before activation.', 'NOT_REVIEWED', 'PENDING_CLINICAL_REVIEW', 'INACTIVE', true, false, CURRENT_TIMESTAMP),
    ('11111111-1111-4111-8111-111111111006', 'AD8', 'Cognitive impairment screening candidate', 'AD8', 'COGNITIVE', 'A candidate cognitive screen. It is not a dementia diagnosis.', 'Adults, after clinical and licensing approval.', 'Questions are withheld until the clinical lead approves a licensed version.', 'en', 5, 'AD8 or another approved cognitive screen. Confirm licensing before reproduction.', 'NOT_REVIEWED', 'PENDING_CLINICAL_REVIEW', 'INACTIVE', true, false, CURRENT_TIMESTAMP),
    ('11111111-1111-4111-8111-111111111007', 'ASSIST', 'Substance use screening candidate', 'ASSIST', 'SUBSTANCE', 'A candidate substance-use screen. It is not a diagnosis.', 'Adults, after clinical and licensing approval.', 'Questions are withheld until the clinical lead approves a licensed version.', 'en', 10, 'WHO ASSIST or another validated instrument. Confirm terms of use before reproduction.', 'NOT_REVIEWED', 'PENDING_CLINICAL_REVIEW', 'INACTIVE', true, false, CURRENT_TIMESTAMP),
    ('11111111-1111-4111-8111-111111111008', 'OCIR', 'OCD screening candidate', 'OCI-R', 'OCD', 'A candidate obsessive-compulsive screen. It is not a diagnosis.', 'Adults, after clinical and licensing approval.', 'Questions are withheld until the clinical lead approves a licensed version.', 'en', 5, 'OCI-R or another approved instrument. Confirm licensing before reproduction.', 'NOT_REVIEWED', 'PENDING_CLINICAL_REVIEW', 'INACTIVE', true, false, CURRENT_TIMESTAMP),
    ('11111111-1111-4111-8111-111111111009', 'PERSONALITY', 'Personality screening candidate', 'Pending', 'PERSONALITY', 'Reserved for a clinician-selected personality screen. No instrument is active.', 'To be defined by the clinical lead.', 'No questionnaire is available.', 'en', 10, 'Select a licensed instrument before activation. Do not reproduce a questionnaire without clearance.', 'NOT_REVIEWED', 'PENDING_CLINICAL_REVIEW', 'INACTIVE', true, false, CURRENT_TIMESTAMP);

INSERT INTO "ScreeningToolVersion" ("id", "toolId", "version", "scoringAlgorithmVersion", "items", "scoringSpec")
VALUES
    ('22222222-2222-4222-8222-222222222001', '11111111-1111-4111-8111-111111111001', '1.0', NULL, '[]'::jsonb, NULL),
    ('22222222-2222-4222-8222-222222222002', '11111111-1111-4111-8111-111111111002', '1.0', NULL, '[]'::jsonb, NULL),
    ('22222222-2222-4222-8222-222222222003', '11111111-1111-4111-8111-111111111003', '1.0', NULL, '[]'::jsonb, NULL),
    ('22222222-2222-4222-8222-222222222004', '11111111-1111-4111-8111-111111111004', '1.0', NULL, '[]'::jsonb, NULL),
    ('22222222-2222-4222-8222-222222222005', '11111111-1111-4111-8111-111111111005', '1.0', NULL, '[]'::jsonb, NULL),
    ('22222222-2222-4222-8222-222222222006', '11111111-1111-4111-8111-111111111006', '1.0', NULL, '[]'::jsonb, NULL),
    ('22222222-2222-4222-8222-222222222007', '11111111-1111-4111-8111-111111111007', '1.0', NULL, '[]'::jsonb, NULL),
    ('22222222-2222-4222-8222-222222222008', '11111111-1111-4111-8111-111111111008', '1.0', NULL, '[]'::jsonb, NULL),
    ('22222222-2222-4222-8222-222222222009', '11111111-1111-4111-8111-111111111009', '1.0', NULL, '[]'::jsonb, NULL);
