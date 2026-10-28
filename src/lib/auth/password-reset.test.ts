import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { completePasswordReset, requestPasswordReset } from "./password-reset";
import { hashEmailToken } from "./tokens";

describe("password reset", () => {
  it("does not store or return a token when email delivery is not configured", async () => {
    const creates: unknown[] = [];
    const db = {
      user: {
        findUnique: async () => ({
          id: "user-1",
          email: "aminata@example.com",
          deletedAt: null,
          status: "ACTIVE",
        }),
      },
      passwordResetToken: {
        create: async ({ data }: { data: unknown }) => {
          creates.push(data);
        },
      },
    };
    const delivered: string[] = [];
    const result = await requestPasswordReset(
      db as unknown as PrismaClient,
      { identifier: "Aminata@Example.com", now: new Date(), appBaseUrl: "http://localhost:3000" },
      async ({ resetUrl }) => {
        delivered.push(resetUrl);
        return { delivered: false, reason: "not_configured" };
      },
    );
    expect(result).toEqual({ delivered: false });
    expect(creates).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("token=");
  });

  it("stores only a hash after a real delivery and rejects a reused link", async () => {
    const tokens: Array<{ id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null }> = [];
    const users = [{ id: "user-1", email: "aminata@example.com", passwordHash: "old", deletedAt: null, status: "ACTIVE" }];
    let raw = "";
    const db = {
      user: {
        findUnique: async () => users[0],
        update: async ({ data }: { data: { passwordHash: string } }) => {
          users[0].passwordHash = data.passwordHash;
        },
      },
      passwordResetToken: {
        updateMany: async () => ({ count: 0 }),
        create: async ({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
          tokens.push({ id: "reset-1", usedAt: null, ...data });
        },
        findUnique: async ({ where }: { where: { tokenHash: string } }) =>
          tokens.find((token) => token.tokenHash === where.tokenHash) ?? null,
        update: async ({ where, data }: { where: { id: string }; data: { usedAt: Date } }) => {
          const token = tokens.find((row) => row.id === where.id);
          if (!token) throw new Error("missing");
          token.usedAt = data.usedAt;
        },
      },
      $transaction: async (fn: (tx: unknown) => Promise<void>) => fn(db),
    };

    const requested = await requestPasswordReset(
      db as unknown as PrismaClient,
      { identifier: "aminata@example.com", now: new Date("2026-10-18T12:00:00.000Z"), appBaseUrl: "http://localhost:3000" },
      async ({ resetUrl }) => {
        raw = new URL(resetUrl).searchParams.get("token") ?? "";
        return { delivered: true, reason: "sent" };
      },
    );
    expect(requested.delivered).toBe(true);
    expect(tokens[0].tokenHash).toBe(hashEmailToken(raw));
    expect(tokens[0].tokenHash).not.toBe(raw);
    expect(JSON.stringify(requested)).not.toContain(raw);

    const updated = await completePasswordReset(
      db as unknown as PrismaClient,
      { token: raw, password: "CorrectHorse12", now: new Date("2026-10-18T12:10:00.000Z") },
      async (password) => `hashed:${password.length}`,
    );
    expect(updated).toEqual({ ok: true });
    expect(users[0].passwordHash).toBe("hashed:14");
    const reused = await completePasswordReset(
      db as unknown as PrismaClient,
      { token: raw, password: "CorrectHorse12", now: new Date("2026-10-18T12:20:00.000Z") },
      async () => "unused",
    );
    expect(reused.ok).toBe(false);
  });
});
