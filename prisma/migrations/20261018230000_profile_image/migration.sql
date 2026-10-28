ALTER TABLE "User" ADD COLUMN "profileImageKey" TEXT;
ALTER TABLE "User" ADD COLUMN "profileImageType" TEXT;
ALTER TABLE "User" ADD COLUMN "profileImageUpdatedAt" TIMESTAMPTZ(6);
