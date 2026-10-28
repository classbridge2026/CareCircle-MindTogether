import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import type { LiveKitConfigResult } from "@/lib/livekit/config";
import type { LiveKitOperations, TokenGrantInput } from "@/lib/livekit/server";
import { issueConsultationToken, recordParticipantLeave } from "./access";

const PATIENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOCTOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const APPOINTMENT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = new Date("2026-10-19T09:50:00.000Z");

const configured: LiveKitConfigResult = {
  ok: true,
  config: {
    websocketUrl: "wss://example.livekit.cloud",
    httpHost: "https://example.livekit.cloud",
    apiKey: "api-key",
    apiSecret: "super-secret-value",
    tokenTtlSeconds: 600,
    joinWindowMinutes: 15,
    rejoinGraceMinutes: 30,
  },
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: APPOINTMENT,
    status: "CONFIRMED",
    mode: "ONLINE",
    startsAt: new Date("2026-10-19T10:00:00.000Z"),
    endsAt: new Date("2026-10-19T10:30:00.000Z"),
    patient: { userId: PATIENT, fullName: "A Patient", user: { status: "ACTIVE", deletedAt: null } },
    doctor: {
      userId: DOCTOR,
      displayName: "A Clinician",
      verificationStatus: "APPROVED",
      user: { status: "ACTIVE", deletedAt: null },
    },
    specialty: { name: "Psychiatry" },
    consultationService: { name: "Review", preparationInstructions: "Find a quiet room." },
    offering: { notes: null },
    location: null,
    payments: [{ status: "PAID" }],
    ...overrides,
  };
}

function database(current = row()) {
  const audits: Array<Record<string, unknown>> = [];
  let updates = 0;
  const db = {
    appointment: {
      findUnique: async () => current,
      update: async () => {
        updates += 1;
        return current;
      },
      updateMany: async () => {
        updates += 1;
        return { count: 1 };
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        audits.push(data);
        return data;
      },
    },
  };
  return { db: db as unknown as PrismaClient, audits, get updates() { return updates; } };
}

function operations() {
  const signed: TokenGrantInput[] = [];
  const rooms: string[] = [];
  const gateway: LiveKitOperations = {
    ensureRoom: async (roomName) => {
      rooms.push(roomName);
    },
    closeRoom: async () => undefined,
    signToken: async (input) => {
      signed.push(input);
      return "signed-token";
    },
  };
  return { gateway, signed, rooms };
}

describe("consultation token access", () => {
  it("gives the assigned patient a room token and does not start the appointment", async () => {
    const store = database();
    const livekit = operations();
    const result = await issueConsultationToken(
      store.db,
      { actorUserId: PATIENT, actorStatus: "ACTIVE", roleCodes: ["PATIENT"], appointmentId: APPOINTMENT, audioOnly: false, now: NOW },
      { limiter: createRateLimiter({ limit: 5, windowMs: 60_000 }), config: configured, operations: livekit.gateway, now: NOW },
    );
    expect(result).toEqual({ ok: true, serverUrl: "wss://example.livekit.cloud", token: "signed-token" });
    expect(livekit.rooms).toEqual([`cc-apt-${APPOINTMENT}`]);
    expect(livekit.signed[0]).toMatchObject({ identity: `user:${PATIENT}`, role: "patient", ttlSeconds: 600, audioOnly: false });
    expect(store.updates).toBe(0);
    expect(store.audits.some((entry) => entry.action === "consultation.token_issued")).toBe(true);
    expect(JSON.stringify(store.audits)).not.toContain("signed-token");
    expect(JSON.stringify(store.audits)).not.toContain("super-secret-value");
  });

  it("ignores a browser-supplied identity and denies another patient", async () => {
    const store = database();
    const livekit = operations();
    const result = await issueConsultationToken(
      store.db,
      {
        actorUserId: PATIENT,
        actorStatus: "ACTIVE",
        roleCodes: ["PATIENT"],
        appointmentId: APPOINTMENT,
        audioOnly: true,
        now: NOW,
        requestedIdentity: OTHER,
      } as never,
      { limiter: createRateLimiter({ limit: 5, windowMs: 60_000 }), config: configured, operations: livekit.gateway, now: NOW },
    );
    expect(result.ok).toBe(true);
    expect(livekit.signed[0]?.identity).toBe(`user:${PATIENT}`);
    expect(livekit.signed[0]?.audioOnly).toBe(true);

    const denied = database();
    const other = operations();
    const blocked = await issueConsultationToken(
      denied.db,
      { actorUserId: OTHER, actorStatus: "ACTIVE", roleCodes: ["PATIENT"], appointmentId: APPOINTMENT, audioOnly: false, now: NOW },
      { limiter: createRateLimiter({ limit: 5, windowMs: 60_000 }), config: configured, operations: other.gateway, now: NOW },
    );
    expect(blocked).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(other.rooms).toEqual([]);
  });

  it("does not issue a token when LiveKit is not configured", async () => {
    const store = database();
    const livekit = operations();
    const result = await issueConsultationToken(
      store.db,
      { actorUserId: DOCTOR, actorStatus: "ACTIVE", roleCodes: ["DOCTOR"], appointmentId: APPOINTMENT, audioOnly: false, now: NOW },
      { limiter: createRateLimiter({ limit: 5, windowMs: 60_000 }), config: { ok: false, code: "NOT_CONFIGURED" }, operations: livekit.gateway, now: NOW },
    );
    expect(result).toEqual({ ok: false, code: "NOT_CONFIGURED" });
    expect(livekit.rooms).toEqual([]);
    expect(store.updates).toBe(0);
  });

  it("records a leave without completing the appointment", async () => {
    const store = database();
    const result = await recordParticipantLeave(
      store.db,
      { actorUserId: PATIENT, actorStatus: "ACTIVE", roleCodes: ["PATIENT"], appointmentId: APPOINTMENT, now: NOW },
      { limiter: createRateLimiter({ limit: 5, windowMs: 60_000 }) },
    );
    expect(result).toEqual({ ok: true });
    expect(store.updates).toBe(0);
    expect(store.audits[0]?.action).toBe("consultation.left");
  });
});
