import type { PrismaClient } from "@prisma/client";
import { homeForRoles, type AppHome } from "./access";
import { ADMIN_ROLE_CODE, DOCTOR_ROLE_CODE, GENERIC_CREDENTIALS, SUPER_ADMIN_ROLE_CODE } from "./constants";
import { normalizeEmail } from "./email-address";
import { verifyPassword } from "./password";
import { normalizePhone } from "./phone";
import { sessionExpiry } from "./session";
import { createEmailToken, hashSessionToken } from "./tokens";

export type LoginResult =
  | { ok: true; sessionToken: string; destination: AppHome }
  | { ok: false; formMessage: string; code: "invalid" | "verify" | "unavailable" };

export async function authenticatePatient(
  db: PrismaClient,
  input: {
    email?: string;
    identifier?: string;
    password: string;
    now: Date;
    userAgent?: string | null;
    ipAddressHash?: string | null;
  },
): Promise<LoginResult> {
  const raw = (input.identifier ?? input.email ?? "").trim();
  const emailNormalized = normalizeEmail(raw);
  const phoneE164 = emailNormalized ? null : normalizePhone(raw);
  if ((!emailNormalized && !phoneE164) || !input.password || input.password.length > 128) {
    await verifyPassword(input.password || " ", await unusedHash());
    return { ok: false, formMessage: GENERIC_CREDENTIALS, code: "invalid" };
  }

  const accountSelect = {
    id: true,
    deletedAt: true,
    passwordHash: true,
    status: true,
    roles: { select: { role: { select: { code: true } } } },
  } as const;
  const user = emailNormalized
    ? await db.user.findUnique({ where: { emailNormalized }, select: accountSelect })
    : await db.user.findUnique({ where: { phoneE164: phoneE164 ?? undefined }, select: accountSelect });

  const passwordMatches = user
    ? await verifyPassword(input.password, user.passwordHash)
    : await verifyPassword(input.password, await unusedHash());

  if (!user || user.deletedAt || !passwordMatches) {
    return { ok: false, formMessage: GENERIC_CREDENTIALS, code: "invalid" };
  }

  const roleCodes = user.roles.map((entry) => entry.role.code);
  const staffAccount = roleCodes.some((code) =>
    code === DOCTOR_ROLE_CODE || code === ADMIN_ROLE_CODE || code === SUPER_ADMIN_ROLE_CODE,
  );
  if (user.status === "PENDING_VERIFICATION") {
    if (staffAccount) {
      return {
        ok: false,
        formMessage: "Verify your email before signing in.",
        code: "verify",
      };
    }
    await db.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE" },
    });
  } else if (user.status !== "ACTIVE") {
    return { ok: false, formMessage: "This account cannot sign in.", code: "unavailable" };
  }

  const destination = homeForRoles(roleCodes);
  if (!destination) {
    return { ok: false, formMessage: "This account cannot sign in.", code: "unavailable" };
  }

  const sessionToken = createEmailToken().raw;
  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt: sessionExpiry(input.now),
      userAgent: input.userAgent ?? null,
      ipAddressHash: input.ipAddressHash ?? null,
    },
  });

  return { ok: true, sessionToken, destination };
}

let cachedUnusedHash: string | null = null;

async function unusedHash(): Promise<string> {
  if (!cachedUnusedHash) {
    const { hashPassword } = await import("./password");
    cachedUnusedHash = await hashPassword("unused-carecircle-credential");
  }
  return cachedUnusedHash;
}
