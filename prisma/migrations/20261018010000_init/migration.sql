-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "DoctorVerificationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('LICENSE', 'DEGREE', 'IDENTITY_DOCUMENT', 'SPECIALTY_CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "CredentialReviewStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ConsultationMode" AS ENUM ('ONLINE', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING_PAYMENT', 'EXPIRED_UNPAID', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR', 'CANCELLED_BY_ADMIN', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "AppointmentBookingSource" AS ENUM ('WEB', 'MOBILE', 'ADMIN');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'REQUIRES_ACTION', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GuardianRelationshipType" AS ENUM ('PARENT', 'LEGAL_GUARDIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "GuardianAuthorizationStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'DENIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PRIVACY_NOTICE', 'TERMS_OF_USE', 'DATA_PROCESSING', 'TELEHEALTH', 'GUARDIAN_AUTHORIZATION');

-- CreateEnum
CREATE TYPE "ClinicalNoteKind" AS ENUM ('PRIVATE_WORKING', 'PATIENT_SUMMARY');

-- CreateEnum
CREATE TYPE "SummaryReleaseStatus" AS ENUM ('NOT_RELEASED', 'RELEASED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "MedicalFilePurpose" AS ENUM ('CREDENTIAL', 'CLINICAL_ATTACHMENT', 'CONSENT_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "RecordAccessAction" AS ENUM ('READ', 'CREATE', 'UPDATE', 'RELEASE', 'WITHDRAW', 'EXPORT', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "phoneE164" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Freetown',
    "emailVerifiedAt" TIMESTAMPTZ(6),
    "phoneVerifiedAt" TIMESTAMPTZ(6),
    "lastLoginAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" UUID,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddressHash" TEXT,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneVerificationToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6) NOT NULL,
    "withdrawnAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "preferredLanguage" TEXT,
    "dateOfBirth" DATE,
    "isDependent" BOOLEAN NOT NULL DEFAULT false,
    "emergencyContactName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianRelationship" (
    "id" UUID NOT NULL,
    "guardianUserId" UUID NOT NULL,
    "dependentPatientId" UUID NOT NULL,
    "relationshipType" "GuardianRelationshipType" NOT NULL,
    "status" "GuardianAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "authorizedAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GuardianRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "biography" TEXT,
    "yearsExperience" INTEGER,
    "licenseNumberNormalized" TEXT,
    "licenseJurisdiction" TEXT,
    "verificationStatus" "DoctorVerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMPTZ(6),
    "verifiedAt" TIMESTAMPTZ(6),
    "rejectedAt" TIMESTAMPTZ(6),
    "suspendedAt" TIMESTAMPTZ(6),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorCredential" (
    "id" UUID NOT NULL,
    "doctorProfileId" UUID NOT NULL,
    "type" "CredentialType" NOT NULL,
    "status" "CredentialReviewStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "issuedOn" DATE,
    "expiresOn" DATE,
    "reviewedAt" TIMESTAMPTZ(6),
    "reviewedByUserId" UUID,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DoctorCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Specialty" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorSpecialty" (
    "id" UUID NOT NULL,
    "doctorProfileId" UUID NOT NULL,
    "specialtyId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorSpecialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationService" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultDurationMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ConsultationService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorOffering" (
    "id" UUID NOT NULL,
    "doctorProfileId" UUID NOT NULL,
    "specialtyId" UUID NOT NULL,
    "consultationServiceId" UUID NOT NULL,
    "mode" "ConsultationMode" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "priceAmountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'SLL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMPTZ(6),
    "validTo" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DoctorOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "locality" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL DEFAULT 'SL',
    "accessInstructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deactivatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorAvailabilityRule" (
    "id" UUID NOT NULL,
    "doctorProfileId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "localStartTime" TIME(0) NOT NULL,
    "localEndTime" TIME(0) NOT NULL,
    "timezone" TEXT NOT NULL,
    "mode" "ConsultationMode",
    "locationId" UUID,
    "offeringId" UUID,
    "validFrom" DATE,
    "validUntil" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DoctorAvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorTimeOff" (
    "id" UUID NOT NULL,
    "doctorProfileId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DoctorTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "doctorProfileId" UUID NOT NULL,
    "specialtyId" UUID NOT NULL,
    "consultationServiceId" UUID NOT NULL,
    "offeringId" UUID,
    "locationId" UUID,
    "mode" "ConsultationMode" NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "paymentHoldExpiresAt" TIMESTAMPTZ(6),
    "feeAmountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'SLL',
    "bookingSource" "AppointmentBookingSource" NOT NULL DEFAULT 'WEB',
    "followUpOfId" UUID,
    "rescheduledFromId" UUID,
    "cancelledAt" TIMESTAMPTZ(6),
    "cancellationReason" TEXT,
    "checkedInAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentEvent" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "actorUserId" UUID,
    "fromStatus" "AppointmentStatus",
    "toStatus" "AppointmentStatus" NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detail" TEXT,

    CONSTRAINT "AppointmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "payerUserId" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'SLL',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerCode" TEXT NOT NULL,
    "providerReference" TEXT,
    "providerAccountId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "providerCode" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "payloadSummary" JSONB,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "doctorProfileId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(6),
    "endedAt" TIMESTAMPTZ(6),
    "archivedAt" TIMESTAMPTZ(6),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "authorDoctorProfileId" UUID NOT NULL,
    "kind" "ClinicalNoteKind" NOT NULL,
    "body" TEXT NOT NULL,
    "summaryReleaseStatus" "SummaryReleaseStatus" NOT NULL DEFAULT 'NOT_RELEASED',
    "releasedAt" TIMESTAMPTZ(6),
    "releasedByUserId" UUID,
    "archivedAt" TIMESTAMPTZ(6),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNoteVersion" (
    "id" UUID NOT NULL,
    "clinicalNoteId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "editorUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalNoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordAccessLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "clinicalNoteId" UUID,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "action" "RecordAccessAction" NOT NULL,
    "requestId" TEXT,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalFile" (
    "id" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "purpose" "MedicalFilePurpose" NOT NULL,
    "uploaderUserId" UUID NOT NULL,
    "patientProfileId" UUID,
    "encounterId" UUID,
    "clinicalNoteId" UUID,
    "doctorCredentialId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "preview" TEXT,
    "entityType" TEXT,
    "entityId" UUID,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "readAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'USER',
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "requestId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneE164_key" ON "User"("phoneE164");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneVerificationToken_tokenHash_key" ON "PhoneVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PhoneVerificationToken_userId_idx" ON "PhoneVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "PhoneVerificationToken_expiresAt_idx" ON "PhoneVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_consentType_idx" ON "ConsentRecord"("consentType");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_userId_consentType_documentVersion_key" ON "ConsentRecord"("userId", "consentType", "documentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_userId_key" ON "PatientProfile"("userId");

-- CreateIndex
CREATE INDEX "PatientProfile_isDependent_idx" ON "PatientProfile"("isDependent");

-- CreateIndex
CREATE INDEX "GuardianRelationship_dependentPatientId_idx" ON "GuardianRelationship"("dependentPatientId");

-- CreateIndex
CREATE INDEX "GuardianRelationship_status_idx" ON "GuardianRelationship"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianRelationship_guardianUserId_dependentPatientId_key" ON "GuardianRelationship"("guardianUserId", "dependentPatientId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_userId_key" ON "DoctorProfile"("userId");

-- CreateIndex
CREATE INDEX "DoctorProfile_verificationStatus_idx" ON "DoctorProfile"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_licenseJurisdiction_licenseNumberNormalized_key" ON "DoctorProfile"("licenseJurisdiction", "licenseNumberNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorCredential_storageKey_key" ON "DoctorCredential"("storageKey");

-- CreateIndex
CREATE INDEX "DoctorCredential_doctorProfileId_idx" ON "DoctorCredential"("doctorProfileId");

-- CreateIndex
CREATE INDEX "DoctorCredential_status_idx" ON "DoctorCredential"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Specialty_code_key" ON "Specialty"("code");

-- CreateIndex
CREATE INDEX "Specialty_isActive_idx" ON "Specialty"("isActive");

-- CreateIndex
CREATE INDEX "DoctorSpecialty_specialtyId_idx" ON "DoctorSpecialty"("specialtyId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSpecialty_doctorProfileId_specialtyId_key" ON "DoctorSpecialty"("doctorProfileId", "specialtyId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationService_code_key" ON "ConsultationService"("code");

-- CreateIndex
CREATE INDEX "ConsultationService_isActive_idx" ON "ConsultationService"("isActive");

-- CreateIndex
CREATE INDEX "DoctorOffering_doctorProfileId_isActive_idx" ON "DoctorOffering"("doctorProfileId", "isActive");

-- CreateIndex
CREATE INDEX "DoctorOffering_specialtyId_idx" ON "DoctorOffering"("specialtyId");

-- CreateIndex
CREATE INDEX "DoctorOffering_consultationServiceId_idx" ON "DoctorOffering"("consultationServiceId");

-- CreateIndex
CREATE INDEX "Location_isActive_idx" ON "Location"("isActive");

-- CreateIndex
CREATE INDEX "Location_district_idx" ON "Location"("district");

-- CreateIndex
CREATE INDEX "DoctorAvailabilityRule_doctorProfileId_isActive_idx" ON "DoctorAvailabilityRule"("doctorProfileId", "isActive");

-- CreateIndex
CREATE INDEX "DoctorAvailabilityRule_locationId_idx" ON "DoctorAvailabilityRule"("locationId");

-- CreateIndex
CREATE INDEX "DoctorTimeOff_doctorProfileId_startsAt_endsAt_idx" ON "DoctorTimeOff"("doctorProfileId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Appointment_patientProfileId_startsAt_idx" ON "Appointment"("patientProfileId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_doctorProfileId_startsAt_idx" ON "Appointment"("doctorProfileId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_status_paymentHoldExpiresAt_idx" ON "Appointment"("status", "paymentHoldExpiresAt");

-- CreateIndex
CREATE INDEX "Appointment_locationId_idx" ON "Appointment"("locationId");

-- CreateIndex
CREATE INDEX "Appointment_followUpOfId_idx" ON "Appointment"("followUpOfId");

-- CreateIndex
CREATE INDEX "Appointment_rescheduledFromId_idx" ON "Appointment"("rescheduledFromId");

-- CreateIndex
CREATE INDEX "AppointmentEvent_appointmentId_occurredAt_idx" ON "AppointmentEvent"("appointmentId", "occurredAt");

-- CreateIndex
CREATE INDEX "AppointmentEvent_actorUserId_idx" ON "AppointmentEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "Payment_appointmentId_idx" ON "Payment"("appointmentId");

-- CreateIndex
CREATE INDEX "Payment_payerUserId_idx" ON "Payment"("payerUserId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerCode_providerReference_key" ON "Payment"("providerCode", "providerReference");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_occurredAt_idx" ON "PaymentEvent"("paymentId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_providerCode_providerEventId_key" ON "PaymentEvent"("providerCode", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_appointmentId_key" ON "Encounter"("appointmentId");

-- CreateIndex
CREATE INDEX "Encounter_patientProfileId_createdAt_idx" ON "Encounter"("patientProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "Encounter_doctorProfileId_idx" ON "Encounter"("doctorProfileId");

-- CreateIndex
CREATE INDEX "ClinicalNote_encounterId_idx" ON "ClinicalNote"("encounterId");

-- CreateIndex
CREATE INDEX "ClinicalNote_authorDoctorProfileId_idx" ON "ClinicalNote"("authorDoctorProfileId");

-- CreateIndex
CREATE INDEX "ClinicalNote_kind_summaryReleaseStatus_idx" ON "ClinicalNote"("kind", "summaryReleaseStatus");

-- CreateIndex
CREATE INDEX "ClinicalNoteVersion_editorUserId_idx" ON "ClinicalNoteVersion"("editorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalNoteVersion_clinicalNoteId_version_key" ON "ClinicalNoteVersion"("clinicalNoteId", "version");

-- CreateIndex
CREATE INDEX "RecordAccessLog_patientProfileId_occurredAt_idx" ON "RecordAccessLog"("patientProfileId", "occurredAt");

-- CreateIndex
CREATE INDEX "RecordAccessLog_actorUserId_occurredAt_idx" ON "RecordAccessLog"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "RecordAccessLog_entityType_entityId_idx" ON "RecordAccessLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "RecordAccessLog_requestId_idx" ON "RecordAccessLog"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalFile_storageKey_key" ON "MedicalFile"("storageKey");

-- CreateIndex
CREATE INDEX "MedicalFile_patientProfileId_idx" ON "MedicalFile"("patientProfileId");

-- CreateIndex
CREATE INDEX "MedicalFile_uploaderUserId_idx" ON "MedicalFile"("uploaderUserId");

-- CreateIndex
CREATE INDEX "MedicalFile_encounterId_idx" ON "MedicalFile"("encounterId");

-- CreateIndex
CREATE INDEX "MedicalFile_doctorCredentialId_idx" ON "MedicalFile"("doctorCredentialId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_occurredAt_idx" ON "AuditLog"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_occurredAt_idx" ON "AuditLog"("action", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneVerificationToken" ADD CONSTRAINT "PhoneVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_dependentPatientId_fkey" FOREIGN KEY ("dependentPatientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorCredential" ADD CONSTRAINT "DoctorCredential_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorCredential" ADD CONSTRAINT "DoctorCredential_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSpecialty" ADD CONSTRAINT "DoctorSpecialty_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSpecialty" ADD CONSTRAINT "DoctorSpecialty_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorOffering" ADD CONSTRAINT "DoctorOffering_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorOffering" ADD CONSTRAINT "DoctorOffering_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorOffering" ADD CONSTRAINT "DoctorOffering_consultationServiceId_fkey" FOREIGN KEY ("consultationServiceId") REFERENCES "ConsultationService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAvailabilityRule" ADD CONSTRAINT "DoctorAvailabilityRule_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAvailabilityRule" ADD CONSTRAINT "DoctorAvailabilityRule_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAvailabilityRule" ADD CONSTRAINT "DoctorAvailabilityRule_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "DoctorOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorTimeOff" ADD CONSTRAINT "DoctorTimeOff_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_consultationServiceId_fkey" FOREIGN KEY ("consultationServiceId") REFERENCES "ConsultationService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "DoctorOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_followUpOfId_fkey" FOREIGN KEY ("followUpOfId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_authorDoctorProfileId_fkey" FOREIGN KEY ("authorDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_releasedByUserId_fkey" FOREIGN KEY ("releasedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteVersion" ADD CONSTRAINT "ClinicalNoteVersion_clinicalNoteId_fkey" FOREIGN KEY ("clinicalNoteId") REFERENCES "ClinicalNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteVersion" ADD CONSTRAINT "ClinicalNoteVersion_editorUserId_fkey" FOREIGN KEY ("editorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordAccessLog" ADD CONSTRAINT "RecordAccessLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordAccessLog" ADD CONSTRAINT "RecordAccessLog_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordAccessLog" ADD CONSTRAINT "RecordAccessLog_clinicalNoteId_fkey" FOREIGN KEY ("clinicalNoteId") REFERENCES "ClinicalNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalFile" ADD CONSTRAINT "MedicalFile_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalFile" ADD CONSTRAINT "MedicalFile_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalFile" ADD CONSTRAINT "MedicalFile_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalFile" ADD CONSTRAINT "MedicalFile_clinicalNoteId_fkey" FOREIGN KEY ("clinicalNoteId") REFERENCES "ClinicalNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalFile" ADD CONSTRAINT "MedicalFile_doctorCredentialId_fkey" FOREIGN KEY ("doctorCredentialId") REFERENCES "DoctorCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Time-range integrity
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_endsAt_after_startsAt"
  CHECK ("endsAt" > "startsAt");

-- Prisma 6 cannot express CHECKs. PENDING_PAYMENT must carry an explicit hold expiry (no DB default).
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_pending_payment_requires_expiry"
  CHECK (
    "status" <> 'PENDING_PAYMENT'
    OR "paymentHoldExpiresAt" IS NOT NULL
  );

ALTER TABLE "DoctorTimeOff"
  ADD CONSTRAINT "DoctorTimeOff_endsAt_after_startsAt"
  CHECK ("endsAt" > "startsAt");

ALTER TABLE "DoctorAvailabilityRule"
  ADD CONSTRAINT "DoctorAvailabilityRule_dayOfWeek_iso"
  CHECK ("dayOfWeek" >= 1 AND "dayOfWeek" <= 7);

-- One active offering per doctor/specialty/service/mode (price changes update the row or deactivate then insert)
CREATE UNIQUE INDEX "DoctorOffering_active_unique"
  ON "DoctorOffering" ("doctorProfileId", "specialtyId", "consultationServiceId", "mode")
  WHERE "isActive" = true;

-- Overlap protection for occupying doctor appointments.
-- Requires btree_gist so UUID equality can be used in a GiST exclusion constraint.
-- Half-open tstzrange [) allows one appointment to end when the next begins.
-- Occupying statuses: PENDING_PAYMENT (active unpaid hold), CONFIRMED, CHECKED_IN, IN_PROGRESS.
-- Do not use NOW() in this predicate (volatile). Expire holds by setting EXPIRED_UNPAID in application transactions.
-- Cancelled, rescheduled, completed, no-show, and expired-unpaid do not occupy the range.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_doctor_occupying_no_overlap"
  EXCLUDE USING gist (
    "doctorProfileId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE (
    "status" IN (
      'PENDING_PAYMENT',
      'CONFIRMED',
      'CHECKED_IN',
      'IN_PROGRESS'
    )
  );

-- Safety net for concurrent booking: expire overdue holds for this doctor before the new row is checked
-- against the exclusion constraint. Does not use NOW() in the exclusion predicate.
-- Events reference existing appointments only (not NEW), so this is valid in BEFORE INSERT.
CREATE OR REPLACE FUNCTION "Appointment_expire_overdue_holds"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" = 'PENDING_PAYMENT' AND (
    NEW."paymentHoldExpiresAt" IS NULL
    OR NEW."paymentHoldExpiresAt" <= CURRENT_TIMESTAMP
  ) THEN
    RAISE EXCEPTION 'PENDING_PAYMENT requires a future paymentHoldExpiresAt'
      USING ERRCODE = 'check_violation';
  END IF;

  WITH expired AS (
    UPDATE "Appointment" AS a
    SET
      "status" = 'EXPIRED_UNPAID',
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE a."status" = 'PENDING_PAYMENT'
      AND a."paymentHoldExpiresAt" IS NOT NULL
      AND a."paymentHoldExpiresAt" <= CURRENT_TIMESTAMP
      AND a."doctorProfileId" = NEW."doctorProfileId"
    RETURNING a."id"
  )
  INSERT INTO "AppointmentEvent" ("id", "appointmentId", "fromStatus", "toStatus", "occurredAt", "detail")
  SELECT gen_random_uuid(), expired."id", 'PENDING_PAYMENT', 'EXPIRED_UNPAID', CURRENT_TIMESTAMP, 'hold_expired_automatically'
  FROM expired;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Appointment_expire_overdue_holds_before_insert"
  BEFORE INSERT ON "Appointment"
  FOR EACH ROW
  EXECUTE PROCEDURE "Appointment_expire_overdue_holds"();

-- Initial catalog (no patient data). Minor-care flags stay disabled until launch policy is approved.
INSERT INTO "Role" ("id", "code", "name", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'PATIENT', 'Patient', 'Patient account', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DOCTOR', 'Doctor', 'Clinician account', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ADMIN', 'Administrator', 'CareCircle operations', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SUPER_ADMIN', 'Super administrator', 'Privileged CareCircle administration', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "Specialty" ("id", "code", "name", "description", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'PSYCHIATRY', 'Psychiatry', 'Psychiatric assessment and follow-up. Additional specialties can be added without a schema change.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "ConsultationService" ("id", "code", "name", "description", "defaultDurationMinutes", "isActive", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'INITIAL', 'Initial consultation', 'First visit for a specialty', 45, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'FOLLOW_UP', 'Follow-up consultation', 'Subsequent visit', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "PlatformSetting" ("id", "key", "valueJson", "updatedAt", "createdAt") VALUES
  (gen_random_uuid(), 'MINOR_REGISTRATION_ENABLED', 'false'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MINOR_TREATMENT_ENABLED', 'false'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'APPOINTMENT_PAYMENT_HOLD_MINUTES', '10'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
