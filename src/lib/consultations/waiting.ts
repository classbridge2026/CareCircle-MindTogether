import type { Prisma, PrismaClient } from "@prisma/client";
import { sharedRateLimiter, type RateLimiter } from "@/lib/auth/rate-limit";
import { parseUuid } from "@/lib/catalog/rules";
import { readLiveKitConfig, type LiveKitConfigResult } from "@/lib/livekit/config";
import type { AccessCode } from "./access";
import { joinDecision, type ConsultationAppointment } from "./eligibility";

const FRESH_MS = 12_000;
const waitingLimiter = sharedRateLimiter("consultation-waiting", { limit: 40, windowMs: 60_000 });

type Presence = { at: number };

function store(): Map<string, Presence> {
  const globalStore = globalThis as typeof globalThis & { __carecircleWaiting?: Map<string, Presence> };
  if (!globalStore.__carecircleWaiting) globalStore.__carecircleWaiting = new Map();
  return globalStore.__carecircleWaiting;
}

export function markPatientWaiting(appointmentId: string, now = Date.now()) {
  store().set(appointmentId, { at: now });
}

export function clearPatientWaiting(appointmentId: string) {
  store().delete(appointmentId);
}

export function patientIsWaiting(appointmentId: string, now = Date.now()) {
  const row = store().get(appointmentId);
  if (!row) return false;
  if (now - row.at > FRESH_MS) {
    store().delete(appointmentId);
    return false;
  }
  return true;
}

export function resetWaitingRoomForTests() {
  store().clear();
}

const waitingSelect = {
  id: true,
  status: true,
  mode: true,
  startsAt: true,
  endsAt: true,
  patient: {
    select: {
      userId: true,
      fullName: true,
      user: { select: { status: true, profileImageUpdatedAt: true } },
    },
  },
  doctor: {
    select: {
      userId: true,
      displayName: true,
      verificationStatus: true,
      user: { select: { status: true, deletedAt: true } },
    },
  },
  feeAmountMinor: true,
  payments: { select: { status: true } },
} satisfies Prisma.AppointmentSelect;

type WaitingRow = Prisma.AppointmentGetPayload<{ select: typeof waitingSelect }>;

export type WaitingPatient = {
  appointmentId: string;
  patientName: string;
  patientUserId: string;
  patientImageVersion: string | null;
};

function toAppointment(row: WaitingRow): ConsultationAppointment {
  return {
    mode: row.mode,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    patientUserId: row.patient.userId,
    doctorUserId: row.doctor.userId,
    patientStatus: row.patient.user.status,
    doctorStatus: row.doctor.user.status,
    doctorDeletedAt: row.doctor.user.deletedAt,
    doctorVerificationStatus: row.doctor.verificationStatus,
    paymentStatuses: row.payments.map((payment) => payment.status),
    feeAmountMinor: row.feeAmountMinor,
  };
}

function mayEnter(row: WaitingRow, input: { actorUserId: string; actorStatus: string; roleCodes: string[]; now: Date }, config: LiveKitConfigResult) {
  return joinDecision({
    actor: { userId: input.actorUserId, status: input.actorStatus, roleCodes: input.roleCodes },
    appointment: toAppointment(row),
    now: input.now,
    joinWindowMinutes: config.ok ? config.config.joinWindowMinutes : 15,
    rejoinGraceMinutes: config.ok ? config.config.rejoinGraceMinutes : 30,
  });
}

export async function notePatientWaiting(
  db: PrismaClient,
  input: { actorUserId: string; actorStatus: string; roleCodes: string[]; appointmentId: string; now?: Date },
  deps: { limiter?: RateLimiter; config?: LiveKitConfigResult; now?: Date } = {},
): Promise<{ ok: true; noted: boolean } | { ok: false; code: AccessCode }> {
  const now = input.now ?? deps.now ?? new Date();
  if (!parseUuid(input.appointmentId) || !parseUuid(input.actorUserId)) return { ok: false, code: "NOT_FOUND" };
  const limiter = deps.limiter ?? waitingLimiter;
  if (!limiter.check(`consultation-waiting:${input.actorUserId}`, now.getTime()).allowed) return { ok: false, code: "RATE_LIMITED" };
  const row = await db.appointment.findUnique({ where: { id: input.appointmentId }, select: waitingSelect });
  if (!row || row.patient.userId !== input.actorUserId) return { ok: false, code: "NOT_FOUND" };
  const decision = mayEnter(row, { ...input, now }, deps.config ?? readLiveKitConfig());
  if (!decision.ok || decision.role !== "patient") {
    clearPatientWaiting(row.id);
    return { ok: true, noted: false };
  }
  markPatientWaiting(row.id, now.getTime());
  return { ok: true, noted: true };
}

export async function clearNotedPatientWaiting(
  db: PrismaClient,
  input: { actorUserId: string; appointmentId: string; now?: Date },
  deps: { limiter?: RateLimiter; now?: Date } = {},
): Promise<{ ok: true } | { ok: false; code: AccessCode }> {
  const now = input.now ?? deps.now ?? new Date();
  if (!parseUuid(input.appointmentId) || !parseUuid(input.actorUserId)) return { ok: false, code: "NOT_FOUND" };
  const limiter = deps.limiter ?? waitingLimiter;
  if (!limiter.check(`consultation-waiting-clear:${input.actorUserId}`, now.getTime()).allowed) return { ok: false, code: "RATE_LIMITED" };
  const row = await db.appointment.findUnique({ where: { id: input.appointmentId }, select: { id: true, patient: { select: { userId: true } } } });
  if (!row || row.patient.userId !== input.actorUserId) return { ok: false, code: "NOT_FOUND" };
  clearPatientWaiting(row.id);
  return { ok: true };
}

export async function readPatientWaiting(
  db: PrismaClient,
  input: { actorUserId: string; actorStatus: string; roleCodes: string[]; appointmentId: string; now?: Date },
  deps: { limiter?: RateLimiter; config?: LiveKitConfigResult; now?: Date } = {},
): Promise<{ ok: true; waiting: false } | { ok: true; waiting: true; patientName: string } | { ok: false; code: AccessCode }> {
  const now = input.now ?? deps.now ?? new Date();
  if (!parseUuid(input.appointmentId) || !parseUuid(input.actorUserId)) return { ok: false, code: "NOT_FOUND" };
  const limiter = deps.limiter ?? waitingLimiter;
  if (!limiter.check(`consultation-waiting-read:${input.actorUserId}`, now.getTime()).allowed) return { ok: false, code: "RATE_LIMITED" };
  const row = await db.appointment.findUnique({ where: { id: input.appointmentId }, select: waitingSelect });
  if (!row || row.doctor.userId !== input.actorUserId) return { ok: false, code: "NOT_FOUND" };
  const decision = mayEnter(row, { ...input, now }, deps.config ?? readLiveKitConfig());
  if (!decision.ok || decision.role !== "doctor" || !patientIsWaiting(row.id, now.getTime())) return { ok: true, waiting: false };
  return { ok: true, waiting: true, patientName: row.patient.fullName };
}

export async function listDoctorWaiting(
  db: PrismaClient,
  input: { actorUserId: string; actorStatus: string; roleCodes: string[]; now?: Date },
  deps: { limiter?: RateLimiter; config?: LiveKitConfigResult; now?: Date } = {},
): Promise<{ ok: true; waiting: WaitingPatient[] } | { ok: false; code: AccessCode }> {
  const now = input.now ?? deps.now ?? new Date();
  if (!parseUuid(input.actorUserId)) return { ok: false, code: "NOT_FOUND" };
  const limiter = deps.limiter ?? waitingLimiter;
  if (!limiter.check(`consultation-waiting-list:${input.actorUserId}`, now.getTime()).allowed) return { ok: false, code: "RATE_LIMITED" };
  const ids = [...store().keys()].filter((id) => patientIsWaiting(id, now.getTime()));
  if (ids.length === 0) return { ok: true, waiting: [] };
  const doctor = await db.doctorProfile.findUnique({ where: { userId: input.actorUserId }, select: { id: true } });
  if (!doctor) return { ok: true, waiting: [] };
  const rows = await db.appointment.findMany({
    where: { id: { in: ids }, doctorProfileId: doctor.id, mode: "ONLINE" },
    select: waitingSelect,
  });
  const config = deps.config ?? readLiveKitConfig();
  const waiting: WaitingPatient[] = [];
  for (const row of rows) {
    const decision = mayEnter(row, { ...input, now }, config);
    if (!decision.ok || decision.role !== "doctor" || !patientIsWaiting(row.id, now.getTime())) continue;
    waiting.push({
      appointmentId: row.id,
      patientName: row.patient.fullName,
      patientUserId: row.patient.userId,
      patientImageVersion: row.patient.user.profileImageUpdatedAt?.toISOString() ?? null,
    });
  }
  return { ok: true, waiting };
}
