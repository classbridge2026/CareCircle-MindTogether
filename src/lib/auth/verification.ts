import type { Prisma, PrismaClient, UserStatus } from "@prisma/client";
import { nextAccountStatus } from "./access";
import { EMAIL_TOKEN_TTL_MS, PATIENT_ROLE_CODE, PHONE_MAX_ATTEMPTS } from "./constants";
import type { EmailDelivery } from "./delivery";
import type { RateLimiter } from "./rate-limit";
import { sessionExpiry } from "./session";
import {
  createEmailToken,
  hashEmailToken,
  hashPhoneCode,
  hashSessionToken,
  hashesMatch,
} from "./tokens";

const INVALID_MESSAGE = "That verification code is not valid.";
const UNAVAILABLE_MESSAGE = "This account cannot be activated.";

export type VerificationSuccess = {
  ok: true;
  outcome: "activated" | "verified";
  sessionToken: string | null;
};

export type VerificationFailure = {
  ok: false;
  formMessage: string;
};

export type VerificationResult = VerificationSuccess | VerificationFailure;

const userAccountSelect = {
  id: true,
  status: true,
  deletedAt: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  roles: { select: { role: { select: { code: true } } } },
} as const;

type UserWithRoles = Prisma.UserGetPayload<{ select: typeof userAccountSelect }>;

function roleCodes(user: UserWithRoles): string[] {
  return user.roles.map((entry) => entry.role.code);
}

async function openSessionIfAllowed(
  tx: Prisma.TransactionClient,
  user: UserWithRoles,
  verified: { emailVerifiedAt?: Date; phoneVerifiedAt?: Date },
  now: Date,
  meta: { userAgent?: string | null; ipAddressHash?: string | null },
): Promise<{ outcome: "activated" | "verified" | "unavailable"; sessionToken: string | null; status: UserStatus }> {
  const emailVerified = Boolean(verified.emailVerifiedAt || user.emailVerifiedAt);
  const phoneVerified = Boolean(verified.phoneVerifiedAt || user.phoneVerifiedAt);
  const decision = nextAccountStatus({
    current: user.status,
    deleted: Boolean(user.deletedAt),
    contactVerified: emailVerified || phoneVerified,
  });

  await tx.user.update({
    where: { id: user.id },
    data: {
      ...verified,
      status: decision.status,
    },
  });

  if (!decision.openSession || !roleCodes(user).includes(PATIENT_ROLE_CODE)) {
    return { outcome: decision.outcome === "unavailable" ? "unavailable" : "verified", sessionToken: null, status: decision.status };
  }

  const sessionToken = createEmailToken().raw;
  await tx.session.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt: sessionExpiry(now),
      userAgent: meta.userAgent ?? null,
      ipAddressHash: meta.ipAddressHash ?? null,
    },
  });
  return {
    outcome: decision.outcome === "activated" ? "activated" : "verified",
    sessionToken,
    status: decision.status,
  };
}

export async function verifyEmailToken(
  db: PrismaClient,
  input: {
    rawToken: string;
    now: Date;
    userAgent?: string | null;
    ipAddressHash?: string | null;
    rateLimiter: RateLimiter;
    rateKey: string;
  },
): Promise<VerificationResult> {
  const rate = input.rateLimiter.check(input.rateKey);
  if (!rate.allowed) {
    return { ok: false, formMessage: "Too many verification attempts. Wait before trying again." };
  }

  const tokenHash = hashEmailToken(input.rawToken);
  try {
    return await db.$transaction(async (tx) => {
      const token = await tx.emailVerificationToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          usedAt: true,
          expiresAt: true,
          user: { select: userAccountSelect },
        },
      });
      if (!token || token.usedAt || token.expiresAt <= input.now) {
        return { ok: false as const, formMessage: INVALID_MESSAGE };
      }

      const consumed = await tx.emailVerificationToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: input.now } },
        data: { usedAt: input.now },
      });
      if (consumed.count !== 1) {
        return { ok: false as const, formMessage: INVALID_MESSAGE };
      }

      const opened = await openSessionIfAllowed(
        tx,
        token.user,
        { emailVerifiedAt: input.now },
        input.now,
        input,
      );
      if (opened.outcome === "unavailable") {
        return { ok: false as const, formMessage: UNAVAILABLE_MESSAGE };
      }
      return {
        ok: true as const,
        outcome: opened.outcome,
        sessionToken: opened.sessionToken,
      };
    });
  } catch {
    return { ok: false, formMessage: "We could not verify that code. Try again." };
  }
}

export async function verifyPhoneCode(
  db: PrismaClient,
  input: {
    phoneE164: string;
    code: string;
    now: Date;
    userAgent?: string | null;
    ipAddressHash?: string | null;
    rateLimiter: RateLimiter;
    rateKey: string;
  },
): Promise<VerificationResult> {
  const rate = input.rateLimiter.check(input.rateKey);
  if (!rate.allowed) {
    return { ok: false, formMessage: "Too many verification attempts. Wait before trying again." };
  }

  try {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { phoneE164: input.phoneE164 },
        select: userAccountSelect,
      });
      if (!user || user.deletedAt) {
        return { ok: false as const, formMessage: INVALID_MESSAGE };
      }

      const token = await tx.phoneVerificationToken.findFirst({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: input.now },
        },
        orderBy: { createdAt: "desc" },
      });
      if (!token || token.attemptCount >= PHONE_MAX_ATTEMPTS) {
        return { ok: false as const, formMessage: INVALID_MESSAGE };
      }

      const expected = hashPhoneCode(user.id, input.code);
      if (!hashesMatch(token.tokenHash, expected)) {
        await tx.phoneVerificationToken.update({
          where: { id: token.id },
          data: { attemptCount: { increment: 1 } },
        });
        return { ok: false as const, formMessage: INVALID_MESSAGE };
      }

      const consumed = await tx.phoneVerificationToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: input.now },
          attemptCount: { lt: PHONE_MAX_ATTEMPTS },
        },
        data: { usedAt: input.now },
      });
      if (consumed.count !== 1) {
        return { ok: false as const, formMessage: INVALID_MESSAGE };
      }

      const opened = await openSessionIfAllowed(
        tx,
        user,
        { phoneVerifiedAt: input.now },
        input.now,
        input,
      );
      if (opened.outcome === "unavailable") {
        return { ok: false as const, formMessage: UNAVAILABLE_MESSAGE };
      }
      return {
        ok: true as const,
        outcome: opened.outcome,
        sessionToken: opened.sessionToken,
      };
    });
  } catch {
    return { ok: false, formMessage: "We could not verify that code. Try again." };
  }
}

export type ResendResult = {
  message: string;
};

export async function resendVerification(
  db: PrismaClient,
  input: {
    emailNormalized?: string | null;
    phoneE164?: string | null;
    now: Date;
    rateLimiter: RateLimiter;
    rateKey: string;
    emailDelivery: EmailDelivery;
    appBaseUrl: string | null;
  },
): Promise<ResendResult> {
  const honest =
    "If an account is waiting for verification, a new email is sent only when email delivery is configured. No email is sent when email delivery is not configured.";

  const rate = input.rateLimiter.check(input.rateKey);
  if (!rate.allowed) {
    return { message: "Too many resend attempts. Wait before trying again." };
  }

  const resendSelect = {
    id: true,
    email: true,
    phoneE164: true,
    status: true,
    deletedAt: true,
    emailVerifiedAt: true,
    phoneVerifiedAt: true,
  } as const;
  const user = input.emailNormalized
    ? await db.user.findUnique({ where: { emailNormalized: input.emailNormalized }, select: resendSelect })
    : input.phoneE164
      ? await db.user.findUnique({ where: { phoneE164: input.phoneE164 }, select: resendSelect })
      : null;

  if (!user || user.deletedAt || user.status !== "PENDING_VERIFICATION") {
    return { message: honest };
  }

  const emailToken = user.emailVerifiedAt ? null : createEmailToken();
  const emailResult =
    emailToken && input.appBaseUrl
      ? await input.emailDelivery.sendEmailVerification({
          to: user.email,
          verifyUrl: `${input.appBaseUrl}/verify/email#${emailToken.raw}`,
        })
      : { delivered: false, reason: "not_configured" as const };

  if (!emailResult.delivered) {
    return { message: honest };
  }

  await db.$transaction(async (tx) => {
    if (emailResult.delivered && emailToken) {
      await tx.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: input.now },
      });
      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: emailToken.hash,
          expiresAt: new Date(input.now.getTime() + EMAIL_TOKEN_TTL_MS),
        },
      });
    }
  });

  return { message: honest };
}

export function clientVerificationMessage(result: VerificationResult): VerificationFailure | { ok: true } {
  if (!result.ok) {
    return result;
  }
  return { ok: true };
}
