/**
 * Idempotent administrator seed. Re-running updates the password and keeps the account active.
 * Does not print the password.
 *
 * Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in the environment. Do not commit those values.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const EMAIL = process.env.SEED_ADMIN_EMAIL?.trim() ?? "";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "";
const ROLE_CODE = "SUPER_ADMIN";

const ARGON2ID_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

function seedInputError() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(EMAIL) || EMAIL.length > 254) {
    return "Set SEED_ADMIN_EMAIL to the administrator email address.";
  }
  if (PASSWORD.length < 6 || PASSWORD.length > 128 || !/[A-Za-z]/.test(PASSWORD) || !/\d/.test(PASSWORD)) {
    return "Set SEED_ADMIN_PASSWORD to a password of 6 to 128 characters that includes a letter and a number.";
  }
  return null;
}

async function main() {
  const inputError = seedInputError();
  if (inputError) {
    console.error(inputError);
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.findUnique({ where: { code: ROLE_CODE } });
    if (!role) {
      throw new Error("The SUPER_ADMIN role is missing. Apply the database migrations first.");
    }

    const passwordHash = await hash(PASSWORD, ARGON2ID_OPTIONS);
    const emailNormalized = EMAIL.toLowerCase();
    const now = new Date();
    const existing = await prisma.user.findUnique({ where: { emailNormalized }, select: { id: true } });

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            email: EMAIL,
            passwordHash,
            status: "ACTIVE",
            emailVerifiedAt: now,
            deletedAt: null,
          },
        })
      : await prisma.user.create({
          data: {
            email: EMAIL,
            emailNormalized,
            passwordHash,
            status: "ACTIVE",
            emailVerifiedAt: now,
            timezone: "Africa/Freetown",
          },
        });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    });

    await prisma.auditLog.create({
      data: {
        actorType: "SYSTEM",
        actorUserId: user.id,
        action: existing ? "admin.seed_updated" : "admin.seeded",
        entityType: "User",
        entityId: user.id,
        metadata: { role: ROLE_CODE },
      },
    });

    console.log(`seeded_admin=${emailNormalized} role=${ROLE_CODE} ${existing ? "updated" : "created"}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("admin_seed_failed");
  console.error(error instanceof Error ? error.message : "unknown");
  process.exitCode = 1;
});
