-- Delivery tracking for notifications. Additive only.
-- New enum values cannot be used in the same transaction on older PostgreSQL servers.
-- This migration only adds them. Later statements do not reference the new values.

ALTER TYPE "NotificationDeliveryStatus" ADD VALUE IF NOT EXISTS 'SUPPRESSED';
ALTER TYPE "NotificationDeliveryStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMPTZ(6);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "errorCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_idempotencyKey_key" ON "Notification"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "Notification_status_nextRetryAt_idx" ON "Notification"("status", "nextRetryAt");

CREATE TABLE IF NOT EXISTS "NotificationAttempt" (
  "id" UUID NOT NULL,
  "notificationId" UUID NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL,
  "providerMessageId" TEXT,
  "errorCode" TEXT,
  "attemptedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationAttempt_notificationId_attemptNumber_key" ON "NotificationAttempt"("notificationId", "attemptNumber");
CREATE INDEX IF NOT EXISTS "NotificationAttempt_notificationId_attemptedAt_idx" ON "NotificationAttempt"("notificationId", "attemptedAt");

DO $$ BEGIN
  ALTER TABLE "NotificationAttempt"
    ADD CONSTRAINT "NotificationAttempt_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "userId" UUID NOT NULL,
  "emailReminders" BOOLEAN NOT NULL DEFAULT true,
  "smsReminders" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

DO $$ BEGIN
  ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
