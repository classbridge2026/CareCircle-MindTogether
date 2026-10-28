import type { PrismaClient, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";
import { hashEmailToken, hashPhoneCode } from "./tokens";
import { clientVerificationMessage, verifyEmailToken, verifyPhoneCode } from "./verification";
import { authenticatePatient } from "./login";
import { hashPassword } from "./password";

type RoleCode = "PATIENT" | "DOCTOR" | "ADMIN";

type UserRow = {
  id: string;
  email: string;
  emailNormalized: string;
  phoneE164: string | null;
  passwordHash: string;
  status: UserStatus;
  deletedAt: Date | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  roles: RoleCode[];
};

type EmailToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

type PhoneToken = {
  id: string;
  userId: string;
  tokenHash: string;
  attemptCount: number;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

function createMemory() {
  const users: UserRow[] = [];
  const emailTokens: EmailToken[] = [];
  const phoneTokens: PhoneToken[] = [];
  const sessions: Array<{ userId: string; tokenHash: string }> = [];
  let failUserUpdate = false;

  function presentUser(user: UserRow) {
    return {
      ...user,
      roles: user.roles.map((code) => ({ role: { code } })),
    };
  }

  function txFrom(snapshotUsers: UserRow[], snapshotEmail: EmailToken[], snapshotPhone: PhoneToken[], snapshotSessions: typeof sessions) {
    return {
      emailVerificationToken: {
        findUnique: async ({ where }: { where: { tokenHash: string } }) => {
          const token = snapshotEmail.find((row) => row.tokenHash === where.tokenHash);
          if (!token) return null;
          const user = snapshotUsers.find((row) => row.id === token.userId);
          return user ? { ...token, user: presentUser(user) } : null;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; usedAt: null; expiresAt: { gt: Date } };
          data: { usedAt: Date };
        }) => {
          const token = snapshotEmail.find((row) => row.id === where.id);
          if (!token || token.usedAt || token.expiresAt <= where.expiresAt.gt) return { count: 0 };
          token.usedAt = data.usedAt;
          return { count: 1 };
        },
      },
      phoneVerificationToken: {
        findFirst: async ({ where }: { where: { userId: string; usedAt: null; expiresAt: { gt: Date } } }) => {
          return (
            snapshotPhone
              .filter(
                (row) =>
                  row.userId === where.userId && row.usedAt === null && row.expiresAt > where.expiresAt.gt,
              )
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
          );
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { attemptCount: { increment: number } };
        }) => {
          const token = snapshotPhone.find((row) => row.id === where.id);
          if (!token) throw new Error("missing token");
          token.attemptCount += data.attemptCount.increment;
          return token;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; usedAt: null; expiresAt: { gt: Date }; attemptCount: { lt: number } };
          data: { usedAt: Date };
        }) => {
          const token = snapshotPhone.find((row) => row.id === where.id);
          if (
            !token ||
            token.usedAt ||
            token.expiresAt <= where.expiresAt.gt ||
            token.attemptCount >= where.attemptCount.lt
          ) {
            return { count: 0 };
          }
          token.usedAt = data.usedAt;
          return { count: 1 };
        },
      },
      user: {
        findUnique: async ({ where }: { where: { phoneE164?: string; emailNormalized?: string } }) => {
          const user = snapshotUsers.find(
            (row) =>
              (where.phoneE164 && row.phoneE164 === where.phoneE164) ||
              (where.emailNormalized && row.emailNormalized === where.emailNormalized),
          );
          return user ? presentUser(user) : null;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { emailVerifiedAt?: Date; phoneVerifiedAt?: Date; status?: UserStatus };
        }) => {
          if (failUserUpdate) throw new Error("user_update_failed");
          const user = snapshotUsers.find((row) => row.id === where.id);
          if (!user) throw new Error("missing user");
          Object.assign(user, data);
          return user;
        },
      },
      session: {
        create: async ({ data }: { data: { userId: string; tokenHash: string } }) => {
          snapshotSessions.push({ userId: data.userId, tokenHash: data.tokenHash });
          return data;
        },
      },
    };
  }

  const db = {
    $transaction: async (fn: (tx: ReturnType<typeof txFrom>) => Promise<unknown>) => {
      const snapshot = {
        users: structuredClone(users),
        emailTokens: structuredClone(emailTokens),
        phoneTokens: structuredClone(phoneTokens),
        sessions: structuredClone(sessions),
      };
      try {
        return await fn(txFrom(users, emailTokens, phoneTokens, sessions));
      } catch (error) {
        users.splice(0, users.length, ...snapshot.users);
        emailTokens.splice(0, emailTokens.length, ...snapshot.emailTokens);
        phoneTokens.splice(0, phoneTokens.length, ...snapshot.phoneTokens);
        sessions.splice(0, sessions.length, ...snapshot.sessions);
        throw error;
      }
    },
    user: {
      findUnique: async ({ where }: { where: { emailNormalized: string } }) => {
        const user = users.find((row) => row.emailNormalized === where.emailNormalized);
        return user ? { ...presentUser(user) } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: { status?: UserStatus } }) => {
        const user = users.find((row) => row.id === where.id);
        if (!user) throw new Error("missing user");
        Object.assign(user, data);
        return user;
      },
    },
    session: {
      create: async ({ data }: { data: { userId: string; tokenHash: string } }) => {
        sessions.push(data);
        return data;
      },
    },
  };

  return {
    db: db as unknown as PrismaClient,
    users,
    emailTokens,
    phoneTokens,
    sessions,
    setFailUserUpdate(value: boolean) {
      failUserUpdate = value;
    },
  };
}

function addUser(memory: ReturnType<typeof createMemory>, overrides: Partial<UserRow> = {}) {
  const user: UserRow = {
    id: overrides.id ?? "user-1",
    email: "aminata@example.com",
    emailNormalized: "aminata@example.com",
    phoneE164: "+23276000001",
    passwordHash: "hash",
    status: "PENDING_VERIFICATION",
    deletedAt: null,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    roles: ["PATIENT"],
    ...overrides,
  };
  memory.users.push(user);
  return user;
}

describe("verification and sign-in", () => {
  beforeEach(() => {
    process.env.VERIFICATION_PEPPER = "test-pepper";
  });

  it("activates the bound account once, rejects expiry and reuse, and hides the session token", async () => {
    const memory = createMemory();
    const user = addUser(memory);
    addUser(memory, {
      id: "user-2",
      email: "other@example.com",
      emailNormalized: "other@example.com",
      phoneE164: "+23276000002",
    });
    const raw = "email-token-raw";
    memory.emailTokens.push({
      id: "token-1",
      userId: user.id,
      tokenHash: hashEmailToken(raw),
      expiresAt: new Date("2026-10-19T00:00:00.000Z"),
      usedAt: null,
    });
    const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
    const now = new Date("2026-10-18T12:00:00.000Z");
    const result = await verifyEmailToken(memory.db, {
      rawToken: raw,
      now,
      rateLimiter: limiter,
      rateKey: "email",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sessionToken).toBeTruthy();
      expect(clientVerificationMessage(result)).toEqual({ ok: true });
      expect(JSON.stringify(clientVerificationMessage(result))).not.toContain(result.sessionToken ?? "");
    }
    expect(memory.users[0].status).toBe("ACTIVE");
    expect(memory.users[1].status).toBe("PENDING_VERIFICATION");
    expect(memory.sessions).toHaveLength(1);

    const reused = await verifyEmailToken(memory.db, {
      rawToken: raw,
      now,
      rateLimiter: limiter,
      rateKey: "email-2",
    });
    expect(reused).toMatchObject({ ok: false });
    expect(memory.sessions).toHaveLength(1);

    memory.emailTokens.push({
      id: "token-expired",
      userId: "user-2",
      tokenHash: hashEmailToken("expired-token"),
      expiresAt: new Date("2026-10-17T00:00:00.000Z"),
      usedAt: null,
    });
    const expired = await verifyEmailToken(memory.db, {
      rawToken: "expired-token",
      now,
      rateLimiter: limiter,
      rateKey: "email-3",
    });
    expect(expired.ok).toBe(false);
    expect(memory.users[1].emailVerifiedAt).toBeNull();
  });

  it("rolls back token use when account update fails", async () => {
    const memory = createMemory();
    addUser(memory);
    memory.emailTokens.push({
      id: "token-1",
      userId: "user-1",
      tokenHash: hashEmailToken("rollback-token"),
      expiresAt: new Date("2026-10-19T00:00:00.000Z"),
      usedAt: null,
    });
    memory.setFailUserUpdate(true);
    const result = await verifyEmailToken(memory.db, {
      rawToken: "rollback-token",
      now: new Date("2026-10-18T12:00:00.000Z"),
      rateLimiter: createRateLimiter({ limit: 5, windowMs: 60_000 }),
      rateKey: "rollback",
    });
    expect(result.ok).toBe(false);
    expect(memory.emailTokens[0].usedAt).toBeNull();
    expect(memory.users[0].status).toBe("PENDING_VERIFICATION");
    expect(memory.sessions).toHaveLength(0);
  });

  it("binds a phone code to one account, expires it, and locks reuse and extra attempts", async () => {
    const memory = createMemory();
    const user = addUser(memory);
    addUser(memory, { id: "user-2", phoneE164: "+23276000002", emailNormalized: "other@example.com", email: "other@example.com" });
    const code = "123456";
    memory.phoneTokens.push({
      id: "phone-1",
      userId: user.id,
      tokenHash: hashPhoneCode(user.id, code),
      attemptCount: 0,
      expiresAt: new Date("2026-10-18T12:10:00.000Z"),
      usedAt: null,
      createdAt: new Date("2026-10-18T12:00:00.000Z"),
    });
    const now = new Date("2026-10-18T12:05:00.000Z");
    const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
    const wrongAccount = await verifyPhoneCode(memory.db, {
      phoneE164: "+23276000002",
      code,
      now,
      rateLimiter: limiter,
      rateKey: "phone-wrong-account",
    });
    expect(wrongAccount.ok).toBe(false);
    expect(memory.phoneTokens[0].usedAt).toBeNull();
    expect(memory.users[0].status).toBe("PENDING_VERIFICATION");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await verifyPhoneCode(memory.db, {
        phoneE164: "+23276000001",
        code: "000000",
        now,
        rateLimiter: limiter,
        rateKey: `phone-attempt-${attempt}`,
      });
      expect(failed.ok).toBe(false);
    }
    expect(memory.phoneTokens[0].attemptCount).toBe(5);
    const locked = await verifyPhoneCode(memory.db, {
      phoneE164: "+23276000001",
      code,
      now,
      rateLimiter: limiter,
      rateKey: "phone-locked",
    });
    expect(locked.ok).toBe(false);
    expect(memory.users[0].status).toBe("PENDING_VERIFICATION");

    memory.phoneTokens[0].attemptCount = 0;
    memory.phoneTokens[0].expiresAt = new Date("2026-10-18T12:01:00.000Z");
    const expired = await verifyPhoneCode(memory.db, {
      phoneE164: "+23276000001",
      code,
      now,
      rateLimiter: limiter,
      rateKey: "phone-expired",
    });
    expect(expired.ok).toBe(false);

    memory.phoneTokens[0].expiresAt = new Date("2026-10-18T12:20:00.000Z");
    const success = await verifyPhoneCode(memory.db, {
      phoneE164: "+23276000001",
      code,
      now,
      rateLimiter: limiter,
      rateKey: "phone-success",
    });
    expect(success.ok).toBe(true);
    expect(memory.users[0].status).toBe("ACTIVE");
    const reused = await verifyPhoneCode(memory.db, {
      phoneE164: "+23276000001",
      code,
      now,
      rateLimiter: limiter,
      rateKey: "phone-reused",
    });
    expect(reused.ok).toBe(false);
    expect(memory.sessions).toHaveLength(1);
  });

  it("blocks pending and suspended accounts and sends each active role to its own home", async () => {
    const password = "CorrectHorse12";
    const passwordHash = await hashPassword(password);
    const memory = createMemory();
    addUser(memory, { status: "PENDING_VERIFICATION", passwordHash });
    addUser(memory, {
      id: "suspended",
      email: "suspended@example.com",
      emailNormalized: "suspended@example.com",
      phoneE164: "+23276000003",
      status: "SUSPENDED",
      passwordHash,
    });
    addUser(memory, {
      id: "doctor",
      email: "doctor@example.com",
      emailNormalized: "doctor@example.com",
      phoneE164: "+23276000004",
      status: "ACTIVE",
      passwordHash,
      roles: ["DOCTOR"],
    });

    addUser(memory, {
      id: "pending-doctor",
      email: "pending-doctor@example.com",
      emailNormalized: "pending-doctor@example.com",
      phoneE164: "+23276000009",
      status: "PENDING_VERIFICATION",
      passwordHash,
      roles: ["DOCTOR"],
    });

    const pending = await authenticatePatient(memory.db, {
      email: "aminata@example.com",
      password,
      now: new Date(),
    });
    const pendingStaff = await authenticatePatient(memory.db, {
      email: "pending-doctor@example.com",
      password,
      now: new Date(),
    });
    const suspended = await authenticatePatient(memory.db, {
      email: "suspended@example.com",
      password,
      now: new Date(),
    });
    const doctor = await authenticatePatient(memory.db, {
      email: "doctor@example.com",
      password,
      now: new Date(),
    });
    const unknown = await authenticatePatient(memory.db, {
      email: "missing@example.com",
      password,
      now: new Date(),
    });
    const wrong = await authenticatePatient(memory.db, {
      email: "aminata@example.com",
      password: "WrongHorse12",
      now: new Date(),
    });

    expect(pending).toMatchObject({ ok: true, destination: "/patient" });
    expect(memory.users[0].status).toBe("ACTIVE");
    expect(pendingStaff).toMatchObject({ ok: false, code: "verify" });
    expect(suspended).toMatchObject({ ok: false, code: "unavailable" });
    expect(doctor).toMatchObject({ ok: true, destination: "/doctor" });
    expect(unknown.ok).toBe(false);
    expect(wrong.ok).toBe(false);
    if (!unknown.ok && !wrong.ok) {
      expect(unknown.formMessage).toBe(wrong.formMessage);
    }
    expect(memory.sessions).toHaveLength(2);
    expect(JSON.stringify({ pending, suspended, unknown, wrong })).not.toContain(password);
    if (doctor.ok) {
      expect(JSON.stringify({ destination: doctor.destination })).not.toContain(doctor.sessionToken);
    }

    memory.users[0].status = "ACTIVE";
    const signedIn = await authenticatePatient(memory.db, {
      email: "Aminata@Example.com",
      password,
      now: new Date(),
    });
    expect(signedIn).toMatchObject({ ok: true, destination: "/patient" });
    expect(memory.sessions).toHaveLength(3);
    if (signedIn.ok) {
      expect(JSON.stringify({ destination: signedIn.destination })).not.toContain(signedIn.sessionToken);
    }
  });

  it("does not activate a suspended account from a valid email token", async () => {
    const memory = createMemory();
    addUser(memory, { status: "SUSPENDED" });
    memory.emailTokens.push({
      id: "token-1",
      userId: "user-1",
      tokenHash: hashEmailToken("suspended-token"),
      expiresAt: new Date("2026-10-19T00:00:00.000Z"),
      usedAt: null,
    });
    const result = await verifyEmailToken(memory.db, {
      rawToken: "suspended-token",
      now: new Date("2026-10-18T12:00:00.000Z"),
      rateLimiter: createRateLimiter({ limit: 5, windowMs: 60_000 }),
      rateKey: "suspended",
    });
    expect(result).toMatchObject({ ok: false, formMessage: "This account cannot be activated." });
    expect(memory.users[0].status).toBe("SUSPENDED");
    expect(memory.sessions).toHaveLength(0);
  });
});
