-- Public account-support requests submitted from the homepage.

CREATE TABLE "SupportRequest" (
  "id" UUID NOT NULL,
  "email" VARCHAR(120) NOT NULL,
  "category" VARCHAR(40) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "attachmentBytes" BYTEA,
  "attachmentMime" VARCHAR(40),
  "attachmentName" VARCHAR(80),
  "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMPTZ(6),
  CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");
CREATE INDEX "SupportRequest_email_createdAt_idx" ON "SupportRequest"("email", "createdAt");
