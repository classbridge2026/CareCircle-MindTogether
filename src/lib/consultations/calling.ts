import type { Prisma, PrismaClient } from "@prisma/client";
import { sharedRateLimiter, type RateLimiter } from "@/lib/auth/rate-limit";
import { parseUuid } from "@/lib/catalog/rules";
import { readLiveKitConfig, type LiveKitConfigResult } from "@/lib/livekit/config";
import type { AccessCode } from "./access";
import { joinDecision, type ConsultationAppointment } from "./eligibility";

const FRESH_MS = 45_000;
const callingLimiter = sharedRateLimiter("consultation-calling", { limit: 30, windowMs: 60_000 });

type Calling = { at: number; callId: string };
export type CallNoticeKind = "declined" | "left" | "ended";
type CallNotice = { at: number; callId: string; kind: CallNoticeKind };

function store(): Map<string, Calling> {
  const globalStore = globalThis as typeof globalThis & { __carecircleDoctorCalling?: Map<string, Calling> };
  if (!globalStore.__carecircleDoctorCalling) globalStore.__carecircleDoctorCalling = new Map();
  return globalStore.__carecircleDoctorCalling;
}

function notices(): Map<string, CallNotice> {
  const globalStore = globalThis as typeof globalThis & { __carecircleCallNotices?: Map<string, CallNotice> };
  if (!globalStore.__carecircleCallNotices) globalStore.__carecircleCallNotices = new Map();
  return globalStore.__carecircleCallNotices;
}

function held(): Set<string> {
  const globalStore = globalThis as typeof globalThis & { __carecircleCallHeld?: Set<string> };
  if (!globalStore.__carecircleCallHeld) globalStore.__carecircleCallHeld = new Set();
  return globalStore.__carecircleCallHeld;
}

export function beginDoctorCall(appointmentId: string, now = Date.now()) {
  notices().delete(appointmentId);
  held().delete(appointmentId);
  const callId = `call:${appointmentId}:${now}`;
  store().set(appointmentId, { at: now, callId });
  return callId;
}

export function refreshDoctorCall(appointmentId: string, now = Date.now()) {
  const current = store().get(appointmentId);
  if (!current || now - current.at > FRESH_MS) {
    if (held().has(appointmentId)) return null;
    return beginDoctorCall(appointmentId, now);
  }
  current.at = now;
  return current.callId;
}

export function readCallNotice(appointmentId: string, _now = Date.now()) {
  void _now;
  return notices().get(appointmentId) ?? null;
}

export function declineDoctorCall(appointmentId: string, callId: string, now = Date.now()) {
  const current = store().get(appointmentId);
  if (!current || current.callId !== callId) return false;
  notices().set(appointmentId, { at: now, callId, kind: "declined" });
  held().add(appointmentId);
  store().delete(appointmentId);
  return true;
}

export function notePatientLeft(appointmentId: string, now = Date.now()) {
  const existing = readCallNotice(appointmentId, now);
  if (existing?.kind === "ended" || existing?.kind === "declined") return;
  const current = store().get(appointmentId);
  notices().set(appointmentId, { at: now, callId: current?.callId ?? `left:${appointmentId}:${now}`, kind: "left" });
  held().add(appointmentId);
  store().delete(appointmentId);
}

export function endDoctorCall(appointmentId: string, now = Date.now()) {
  const current = store().get(appointmentId);
  notices().set(appointmentId, { at: now, callId: current?.callId ?? `ended:${appointmentId}:${now}`, kind: "ended" });
  held().add(appointmentId);
  store().delete(appointmentId);
}

export function recallDoctorCall(appointmentId: string, now = Date.now()) {
  return beginDoctorCall(appointmentId, now);
}

export function clearDoctorCall(appointmentId: string) {
  store().delete(appointmentId);
}

export function readDoctorCall(appointmentId: string, now = Date.now()) {
  const current = store().get(appointmentId);
  if (!current) return null;
  if (now - current.at > FRESH_MS) {
    store().delete(appointmentId);
    return null;
  }
  return current.callId;
}

export function listedDoctorCallIds(now = Date.now()): string[] {
  const fresh: string[] = [];
  const stale: string[] = [];
  for (const [appointmentId, current] of store()) {
    if (now - current.at > FRESH_MS) stale.push(appointmentId);
    else fresh.push(appointmentId);
  }
  for (const appointmentId of stale) store().delete(appointmentId);
  return fresh;
}

export function resetDoctorCallsForTests() {
  store().clear();
  notices().clear();
  held().clear();
}

const callingSelect = {
  id: true,
  status: true,
  mode: true,
  startsAt: true,
  endsAt: true,
  patient: { select: { userId: true, user: { select: { status: true } } } },
  doctor: {
    select: {
      userId: true,
      verificationStatus: true,
      user: { select: { status: true, deletedAt: true } },
    },
  },
  feeAmountMinor: true,
  payments: { select: { status: true } },
} satisfies Prisma.AppointmentSelect;

type CallingRow = Prisma.AppointmentGetPayload<{ select: typeof callingSelect }>;

function toAppointment(row: CallingRow): ConsultationAppointment {
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

function doctorMayCall(row: CallingRow, input: { actorUserId: string; actorStatus: string; roleCodes: string[]; now: Date }, config: LiveKitConfigResult) {
  if (row.doctor.userId !== input.actorUserId) return false;
  const decision = joinDecision({
    actor: { userId: input.actorUserId, status: input.actorStatus, roleCodes: input.roleCodes },
    appointment: toAppointment(row),
    now: input.now,
    joinWindowMinutes: config.ok ? config.config.joinWindowMinutes : 15,
    rejoinGraceMinutes: config.ok ? config.config.rejoinGraceMinutes : 30,
  });
  return decision.ok && decision.role === "doctor";
}

export async function signalDoctorCalling(
  db: PrismaClient,
  input: { actorUserId: string; actorStatus: string; roleCodes: string[]; appointmentId: string; now?: Date; recall?: boolean },
  deps: { limiter?: RateLimiter; config?: LiveKitConfigResult; now?: Date } = {},
): Promise<{ ok: true } | { ok: false; code: AccessCode }> {
  const now = input.now ?? deps.now ?? new Date();
  if (!parseUuid(input.appointmentId) || !parseUuid(input.actorUserId)) return { ok: false, code: "NOT_FOUND" };
  const limiter = deps.limiter ?? callingLimiter;
  if (!limiter.check(`consultation-calling:${input.actorUserId}`, now.getTime()).allowed) return { ok: false, code: "RATE_LIMITED" };
  const row = await db.appointment.findUnique({ where: { id: input.appointmentId }, select: callingSelect });
  if (!row) return { ok: false, code: "NOT_FOUND" };
  if (!doctorMayCall(row, { ...input, now }, deps.config ?? readLiveKitConfig())) return { ok: false, code: "NOT_FOUND" };
  if (input.recall) recallDoctorCall(row.id, now.getTime());
  else refreshDoctorCall(row.id, now.getTime());
  return { ok: true };
}

export async function stopDoctorCalling(
  db: PrismaClient,
  input: { actorUserId: string; appointmentId: string; now?: Date },
  deps: { limiter?: RateLimiter; now?: Date } = {},
): Promise<{ ok: true } | { ok: false; code: AccessCode }> {
  const now = input.now ?? deps.now ?? new Date();
  if (!parseUuid(input.appointmentId) || !parseUuid(input.actorUserId)) return { ok: false, code: "NOT_FOUND" };
  const limiter = deps.limiter ?? callingLimiter;
  if (!limiter.check(`consultation-calling-stop:${input.actorUserId}`, now.getTime()).allowed) return { ok: false, code: "RATE_LIMITED" };
  const row = await db.appointment.findUnique({
    where: { id: input.appointmentId },
    select: { id: true, doctor: { select: { userId: true } } },
  });
  if (!row || row.doctor.userId !== input.actorUserId) return { ok: false, code: "NOT_FOUND" };
  clearDoctorCall(row.id);
  return { ok: true };
}

export async function readDoctorCallState(
  db: PrismaClient,
  input: { actorUserId: string; appointmentId: string; now?: Date },
  deps: { limiter?: RateLimiter; now?: Date } = {},
): Promise<{ ok: true; calling: boolean; notice: CallNoticeKind | null } | { ok: false; code: AccessCode }> {
  const now = input.now ?? deps.now ?? new Date();
  if (!parseUuid(input.appointmentId) || !parseUuid(input.actorUserId)) return { ok: false, code: "NOT_FOUND" };
  const limiter = deps.limiter ?? callingLimiter;
  if (!limiter.check(`consultation-calling-read:${input.actorUserId}`, now.getTime()).allowed) return { ok: false, code: "RATE_LIMITED" };
  const row = await db.appointment.findUnique({
    where: { id: input.appointmentId },
    select: { id: true, doctor: { select: { userId: true } } },
  });
  if (!row || row.doctor.userId !== input.actorUserId) return { ok: false, code: "NOT_FOUND" };
  const notice = readCallNotice(row.id, now.getTime());
  return { ok: true, calling: readDoctorCall(row.id, now.getTime()) !== null, notice: notice?.kind ?? null };
}

export async function declinePatientCall(
  db: PrismaClient,
  input: { actorUserId: string; appointmentId: string; callId: string; now?: Date },
  deps: { limiter?: RateLimiter; now?: Date } = {},
): Promise<{ ok: true; declined: boolean } | { ok: false; code: AccessCode }> {
  const now = input.now ?? deps.now ?? new Date();
  if (!parseUuid(input.appointmentId) || !parseUuid(input.actorUserId)) return { ok: false, code: "NOT_FOUND" };
  const callId = input.callId.trim();
  if (!callId.startsWith("call:") || callId.length > 160) return { ok: false, code: "NOT_FOUND" };
  const limiter = deps.limiter ?? callingLimiter;
  if (!limiter.check(`consultation-decline:${input.actorUserId}`, now.getTime()).allowed) return { ok: false, code: "RATE_LIMITED" };
  const row = await db.appointment.findUnique({
    where: { id: input.appointmentId },
    select: { id: true, patient: { select: { userId: true } } },
  });
  if (!row || row.patient.userId !== input.actorUserId) return { ok: false, code: "NOT_FOUND" };
  return { ok: true, declined: declineDoctorCall(row.id, callId, now.getTime()) };
}

export async function finishDoctorCall(
  db: PrismaClient,
  input: { actorUserId: string; appointmentId: string; now?: Date },
  deps: { limiter?: RateLimiter; now?: Date } = {},
): Promise<{ ok: true } | { ok: false; code: AccessCode }> {
  const now = input.now ?? deps.now ?? new Date();
  if (!parseUuid(input.appointmentId) || !parseUuid(input.actorUserId)) return { ok: false, code: "NOT_FOUND" };
  const limiter = deps.limiter ?? callingLimiter;
  if (!limiter.check(`consultation-call-end:${input.actorUserId}`, now.getTime()).allowed) return { ok: false, code: "RATE_LIMITED" };
  const row = await db.appointment.findUnique({
    where: { id: input.appointmentId },
    select: { id: true, doctor: { select: { userId: true } } },
  });
  if (!row || row.doctor.userId !== input.actorUserId) return { ok: false, code: "NOT_FOUND" };
  endDoctorCall(row.id, now.getTime());
  return { ok: true };
}
