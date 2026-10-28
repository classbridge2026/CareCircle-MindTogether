-- CreateEnum
CREATE TYPE "ScreeningInstrument" AS ENUM ('PHQ9', 'GAD7', 'AUDIT', 'DAST10');

-- CreateTable
CREATE TABLE "ScreeningResponse" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "instrument" "ScreeningInstrument" NOT NULL,
    "instrumentVersion" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "band" TEXT NOT NULL,
    "safetyFlag" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ScreeningResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningAnswer" (
    "id" UUID NOT NULL,
    "responseId" UUID NOT NULL,
    "itemIndex" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "ScreeningAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningResponseVersion" (
    "id" UUID NOT NULL,
    "responseId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "band" TEXT NOT NULL,
    "safetyFlag" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "editorUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningResponseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningResponse_appointmentId_instrument_key" ON "ScreeningResponse"("appointmentId", "instrument");
CREATE INDEX "ScreeningResponse_patientProfileId_submittedAt_idx" ON "ScreeningResponse"("patientProfileId", "submittedAt");
CREATE INDEX "ScreeningResponse_safetyFlag_idx" ON "ScreeningResponse"("safetyFlag");
CREATE UNIQUE INDEX "ScreeningAnswer_responseId_itemIndex_key" ON "ScreeningAnswer"("responseId", "itemIndex");
CREATE UNIQUE INDEX "ScreeningResponseVersion_responseId_version_key" ON "ScreeningResponseVersion"("responseId", "version");
CREATE INDEX "ScreeningResponseVersion_editorUserId_idx" ON "ScreeningResponseVersion"("editorUserId");

-- AddForeignKey
ALTER TABLE "ScreeningResponse" ADD CONSTRAINT "ScreeningResponse_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScreeningResponse" ADD CONSTRAINT "ScreeningResponse_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScreeningAnswer" ADD CONSTRAINT "ScreeningAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ScreeningResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningResponseVersion" ADD CONSTRAINT "ScreeningResponseVersion_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ScreeningResponse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScreeningResponseVersion" ADD CONSTRAINT "ScreeningResponseVersion_editorUserId_fkey" FOREIGN KEY ("editorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
