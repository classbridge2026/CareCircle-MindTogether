import type { PrismaClient } from "@prisma/client";
import { advanceDoctorAppointment } from "./booking";
import { applyConsultationSideEffects } from "@/lib/consultations/lifecycle";

type Advance = typeof advanceDoctorAppointment;
type Effects = typeof applyConsultationSideEffects;

/** An in-progress visit is over once its scheduled end time has passed. */
export function consultationHasEnded(status: string, endsAt: Date, now: Date) {
  return status === "IN_PROGRESS" && endsAt.getTime() <= now.getTime();
}

export function shownAppointmentStatus(status: string, endsAt: Date, now: Date) {
  return consultationHasEnded(status, endsAt, now) ? "COMPLETED" : status;
}

/** Marks this doctor's or patient's finished visits complete so the schedule no longer says in progress. */
export async function completeEndedConsultations(
  db: PrismaClient,
  input: { now?: Date; doctorProfileId?: string; patientProfileId?: string },
  deps: { advance?: Advance; effects?: Effects } = {},
) {
  const now = input.now ?? new Date();
  const advance = deps.advance ?? advanceDoctorAppointment;
  const effects = deps.effects ?? applyConsultationSideEffects;
  const rows = await db.appointment.findMany({
    where: {
      status: "IN_PROGRESS",
      endsAt: { lte: now },
      ...(input.doctorProfileId ? { doctorProfileId: input.doctorProfileId } : {}),
      ...(input.patientProfileId ? { patientProfileId: input.patientProfileId } : {}),
    },
    select: { id: true, doctor: { select: { userId: true } } },
    take: 20,
  });
  let completed = 0;
  for (const row of rows) {
    try {
      const result = await advance({ actorUserId: row.doctor.userId, appointmentId: row.id, to: "COMPLETED" }, { db, now });
      if (!result.ok) continue;
      await effects(db, { actorUserId: row.doctor.userId, appointmentId: row.id, to: "COMPLETED", now });
      completed += 1;
    } catch {
      // The schedule still presents the visit as finished. The next open tries again.
    }
  }
  return completed;
}
