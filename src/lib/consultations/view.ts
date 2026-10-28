import { readLiveKitConfig, DEFAULT_JOIN_WINDOW_MINUTES, REJOIN_GRACE_MINUTES } from "@/lib/livekit/config";
import { consultationPhase, joinDecision, showsOnlineControls, type ConsultationPhase } from "./eligibility";
import { joinDenialMessage, liveKitUnavailableMessage, phaseMessage } from "./messages";

export function describeVisitJoin(input: {
  actorUserId: string;
  actorStatus: string;
  roleCodes: string[];
  mode: "ONLINE" | "IN_PERSON";
  status: string;
  startsAt: Date;
  endsAt: Date;
  patientUserId: string;
  doctorUserId: string;
  patientStatus: string;
  doctorStatus: string;
  doctorDeletedAt: Date | null;
  doctorVerificationStatus: string;
  paymentStatuses: string[];
  when: string;
  now?: Date;
  audience?: "patient" | "doctor";
}) {
  const now = input.now ?? new Date();
  const config = readLiveKitConfig();
  const decision = joinDecision({
    actor: { userId: input.actorUserId, status: input.actorStatus, roleCodes: input.roleCodes },
    appointment: {
      mode: input.mode,
      status: input.status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      patientUserId: input.patientUserId,
      doctorUserId: input.doctorUserId,
      patientStatus: input.patientStatus,
      doctorStatus: input.doctorStatus,
      doctorDeletedAt: input.doctorDeletedAt,
      doctorVerificationStatus: input.doctorVerificationStatus,
      paymentStatuses: input.paymentStatuses,
    },
    now,
    joinWindowMinutes: config.ok ? config.config.joinWindowMinutes : DEFAULT_JOIN_WINDOW_MINUTES,
    rejoinGraceMinutes: config.ok ? config.config.rejoinGraceMinutes : REJOIN_GRACE_MINUTES,
  });
  const phase: ConsultationPhase = consultationPhase({ mode: input.mode, status: input.status, decision });
  const online = showsOnlineControls(input.mode);
  const canJoin = online && decision.ok && config.ok;
  const audience = input.audience ?? "doctor";
  const message = !online
    ? phaseMessage("in_person", input.when, audience)
    : !decision.ok
      ? joinDenialMessage(decision.code)
      : config.ok
        ? phaseMessage(phase, input.when, audience)
        : liveKitUnavailableMessage();
  return { canJoin, phase, message, configured: config.ok, decision };
}

export function consultationClientProps(input: {
  appointmentId: string;
  canJoin: boolean;
  configured: boolean;
  counterpart: string;
  when: string;
  returnHref: string;
  role: "patient" | "doctor";
  privateNote?: string;
}) {
  return {
    appointmentId: input.appointmentId,
    canJoin: input.canJoin,
    configured: input.configured,
    counterpart: input.counterpart,
    when: input.when,
    returnHref: input.returnHref,
    role: input.role,
  };
}
