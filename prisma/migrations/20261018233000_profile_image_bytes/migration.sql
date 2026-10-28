ALTER TABLE "User" DROP COLUMN "profileImageKey";
ALTER TABLE "User" ADD COLUMN "profileImageBytes" BYTEA;
