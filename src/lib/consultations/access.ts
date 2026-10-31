import type { Prisma, PrismaClient } from "@prisma/client";
import { sanitizeMetadata } from "@/lib/admin/rules";
import { sharedRateLimiter, type RateLimiter } from "@/lib/auth/rate-limit";
import { parseUuid } from "@/lib/catalog/rules";
import { readLiveKitConfig, type LiveKitConfigResult } from "@/lib/livekit/config";
import { liveKitOperations, type LiveKitOperations, type TokenGrantInput } from "@/lib/livekit/server";
import { beginDoctorCall, clearDoctorCall, notePatientLeft } from "./calling";
import {
  consultationRoomName,
  joinDecision,
  participantIdentity,
  type ConsultationAppointment,
  type ConsultationActor,
  type JoinCode,
} from "./eligibility";

const tokenLimiter = sharedRateLimiter("consultation-token", { limit: 10, windowMs: 60_000 });
const leaveLimiter = sharedRateLimiter("consultation-leave", { limit: 20, windowMs: 60_000 });

const consultationSelect = {
  id: true,
  status: true,
  mode: true,
  startsAt: true,
  endsAt: true,
  patient: {
    select: {
      userId: true,
      fullName: true,
      user: { select: { status: true, deletedAt: true } },
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
  specialty: { select: { name: true } },
  consultationService: { select: { name: true, preparationInstructions: true } },
  offering: { select: { notes: true } },
  location: {
    select: {
      name: true,
      addressLine1: true,
      addressLine2: true,
      locality: true,
      district: true,
      countryCode: true,
      phone: true,
      accessInstructions: true,
    },
  },
  feeAmountMinor: true,
  payments: { select: { status: true } },
} satisfies Prisma.AppointmentSelect;

type ConsultationRow = Prisma.AppointmentGetPayload<{ select: typeof consultationSelect }>;

export type AccessCode = JoinCode | "RATE_LIMITED" | "NOT_CONFIGURED" | "UNAVAILABLE" | "INVALID";

export type TokenIssueResult =
  | { ok: true; serverUrl: string; token: string }
  | { ok: false; code: AccessCode };

function rowToAppointment(row: ConsultationRow): ConsultationAppointment {
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

async function audit(
  db: PrismaClient,
  input: { actorUserId: string; appointmentId: string; action: string; metadata?: Record<string, string | number | boolean | null> },
) {
  const metadata = sanitizeMetadata(input.metadata ?? null);
  await db.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: "Appointment",
      entityId: input.appointmentId,
      metadata: metadata ?? undefined,
    },
  });
}

export async function issueConsultationToken(
  db: PrismaClient,
  input: {
    actorUserId: string;
    actorStatus: string;
    roleCodes: string[];
    appointmentId: string;
    audioOnly: boolean;
    now?: Date;
  },
  deps: {
    limiter?: RateLimiter;
    config?: LiveKitConfigResult;
    operations?: LiveKitOperations;
    now?: Date;
  } = {},
): Promise<TokenIssueResult> {
  const now = input.now ?? deps.now ?? new Date();
  if (!parseUuid(input.appointmentId) || !parseUuid(input.actorUserId)) return { ok: false, code: "NOT_FOUND" };
  const limiter = deps.limiter ?? tokenLimiter;
  if (!limiter.check(`consultation-token:${input.actorUserId}`, now.getTime()).allowed) {
    return { ok: false, code: "RATE_LIMITED" };
  }

  const row = await db.appointment.findUnique({ where: { id: input.appointmentId }, select: consultationSelect });
  if (!row) return { ok: false, code: "NOT_FOUND" };

  const actor: ConsultationActor = {
    userId: input.actorUserId,
    status: input.actorStatus,
    roleCodes: input.roleCodes,
  };
  const config = deps.config ?? readLiveKitConfig();
  const decision = joinDecision({
    actor,
    appointment: rowToAppointment(row),
    now,
    joinWindowMinutes: config.ok ? config.config.joinWindowMinutes : 15,
    rejoinGraceMinutes: config.ok ? config.config.rejoinGraceMinutes : 30,
  });
  if (!decision.ok) {
    if (decision.code !== "NOT_FOUND") {
      await audit(db, {
        actorUserId: input.actorUserId,
        appointmentId: row.id,
        action: "consultation.access_denied",
        metadata: { code: decision.code },
      });
    } else {
      await audit(db, {
        actorUserId: input.actorUserId,
        appointmentId: row.id,
        action: "consultation.access_denied",
        metadata: { code: "NOT_FOUND" },
      });
    }
    return decision;
  }
  if (!config.ok) {
    await audit(db, {
      actorUserId: input.actorUserId,
      appointmentId: row.id,
      action: "consultation.access_denied",
      metadata: { code: config.code },
    });
    return { ok: false, code: config.code === "INVALID" ? "INVALID" : "NOT_CONFIGURED" };
  }

  const roomName = consultationRoomName(row.id);
  const identity = participantIdentity(input.actorUserId);
  if (!roomName || !identity) return { ok: false, code: "NOT_FOUND" };

  const operations = deps.operations ?? liveKitOperations(config.config);
  const grant: TokenGrantInput = {
    identity,
    roomName,
    role: decision.role,
    audioOnly: input.audioOnly,
    ttlSeconds: config.config.tokenTtlSeconds,
  };
  try {
    await operations.ensureRoom(roomName);
    const token = await operations.signToken(grant);
    await audit(db, {
      actorUserId: input.actorUserId,
      appointmentId: row.id,
      action: "consultation.token_issued",
      metadata: { role: decision.role, audioOnly: input.audioOnly, ttlSeconds: config.config.tokenTtlSeconds },
    });
    if (decision.role === "doctor") beginDoctorCall(row.id, now.getTime());
    return { ok: true, serverUrl: config.config.websocketUrl, token };
  } catch {
    console.error("livekit_token_failed");
    await audit(db, {
      actorUserId: input.actorUserId,
      appointmentId: row.id,
      action: "consultation.access_denied",
      metadata: { code: "UNAVAILABLE" },
    }).catch(() => undefined);
    return { ok: false, code: "UNAVAILABLE" };
  }
}

export async function recordParticipantLeave(
  db: PrismaClient,
  input: { actorUserId: string; actorStatus: string; roleCodes: string[]; appointmentId: string; now?: Date },
  deps: { limiter?: RateLimiter } = {},
): Promise<{ ok: true } | { ok: false; code: AccessCode }> {
  const now = input.now ?? new Date();
  if (!parseUuid(input.appointmentId) || !parseUuid(input.actorUserId)) return { ok: false, code: "NOT_FOUND" };
  const limiter = deps.limiter ?? leaveLimiter;
  if (!limiter.check(`consultation-leave:${input.actorUserId}`, now.getTime()).allowed) return { ok: false, code: "RATE_LIMITED" };
  const row = await db.appointment.findUnique({ where: { id: input.appointmentId }, select: consultationSelect });
  if (!row) return { ok: false, code: "NOT_FOUND" };
  const isPatient = row.patient.userId === input.actorUserId;
  const isDoctor = row.doctor.userId === input.actorUserId;
  if (isPatient === isDoctor) return { ok: false, code: "NOT_FOUND" };
  if (input.actorStatus !== "ACTIVE") return { ok: false, code: "INACTIVE" };
  if (row.mode !== "ONLINE") return { ok: false, code: "NOT_ONLINE" };
  if (isDoctor) clearDoctorCall(row.id);
  if (isPatient) notePatientLeft(row.id, now.getTime());
  await audit(db, {
    actorUserId: input.actorUserId,
    appointmentId: row.id,
    action: "consultation.left",
    metadata: { role: isPatient ? "patient" : "doctor", status: row.status },
  });
  return { ok: true };
}

export function accessStatus(code: AccessCode): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "INACTIVE":
      return 403;
    case "RATE_LIMITED":
      return 429;
    case "NOT_CONFIGURED":
    case "UNAVAILABLE":
      return 503;
    case "INVALID":
      return 400;
    default:
      return 409;
  }
}
