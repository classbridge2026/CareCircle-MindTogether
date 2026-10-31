import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import type { LiveKitConfigResult } from "@/lib/livekit/config";
import { listDoctorWaiting, markPatientWaiting, notePatientWaiting, patientIsWaiting, readPatientWaiting, resetWaitingRoomForTests } from "./waiting";

const PATIENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOCTOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
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

function row() {
  return {
    id: APPOINTMENT,
    status: "CONFIRMED",
    mode: "ONLINE",
    startsAt: new Date("2026-10-19T10:00:00.000Z"),
    endsAt: new Date("2026-10-19T10:30:00.000Z"),
    patient: { userId: PATIENT, fullName: "Osman", user: { status: "ACTIVE", profileImageUpdatedAt: null } },
    doctor: {
      userId: DOCTOR,
      displayName: "Dr. Kamara",
      verificationStatus: "APPROVED",
      user: { status: "ACTIVE", deletedAt: null },
    },
    feeAmountMinor: 5000,
    payments: [{ status: "PAID" }],
  };
}

function database() {
  return {
    appointment: {
      findUnique: async () => row(),
      findMany: async () => [row()],
    },
    doctorProfile: {
      findUnique: async () => ({ id: "doctor-profile" }),
    },
  } as unknown as PrismaClient;
}

const limiter = () => createRateLimiter({ limit: 10, windowMs: 60_000 });

afterEach(() => resetWaitingRoomForTests());

describe("waiting room", () => {
  it("forgets a patient who stopped signaling", () => {
    markPatientWaiting(APPOINTMENT, NOW.getTime());
    expect(patientIsWaiting(APPOINTMENT, NOW.getTime())).toBe(true);
    expect(patientIsWaiting(APPOINTMENT, NOW.getTime() + 13_000)).toBe(false);
  });

  it("lets the assigned doctor see the waiting patient", async () => {
    const noted = await notePatientWaiting(
      database(),
      { actorUserId: PATIENT, actorStatus: "ACTIVE", roleCodes: ["PATIENT"], appointmentId: APPOINTMENT, now: NOW },
      { limiter: limiter(), config: configured, now: NOW },
    );
    expect(noted).toEqual({ ok: true, noted: true });
    const seen = await readPatientWaiting(
      database(),
      { actorUserId: DOCTOR, actorStatus: "ACTIVE", roleCodes: ["DOCTOR"], appointmentId: APPOINTMENT, now: NOW },
      { limiter: limiter(), config: configured, now: NOW },
    );
    expect(seen).toEqual({ ok: true, waiting: true, patientName: "Osman" });
    const listed = await listDoctorWaiting(
      database(),
      { actorUserId: DOCTOR, actorStatus: "ACTIVE", roleCodes: ["DOCTOR"], now: NOW },
      { limiter: limiter(), config: configured, now: NOW },
    );
    expect(listed).toEqual({
      ok: true,
      waiting: [{ appointmentId: APPOINTMENT, patientName: "Osman", patientUserId: PATIENT, patientImageVersion: null }],
    });
  });

  it("hides the waiting room from anyone else", async () => {
    const stranger = await notePatientWaiting(
      database(),
      { actorUserId: DOCTOR, actorStatus: "ACTIVE", roleCodes: ["DOCTOR"], appointmentId: APPOINTMENT, now: NOW },
      { limiter: limiter(), config: configured, now: NOW },
    );
    expect(stranger).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});
