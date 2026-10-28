import type { Prisma, PrismaClient } from "@prisma/client";
import { OCCUPYING_APPOINTMENT_STATUSES } from "@/lib/admin/rules";
import type { ScheduleRule, TimeBlock } from "./slots";
import { minutesFromClock } from "./time";

type Db = Prisma.TransactionClient | PrismaClient;

export function toScheduleRule(row: {
  dayOfWeek: number;
  localStartTime: Date;
  localEndTime: Date;
  mode: "ONLINE" | "IN_PERSON" | null;
  locationId: string | null;
  offeringId: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  isActive: boolean;
}): ScheduleRule {
  return {
    dayOfWeek: row.dayOfWeek,
    startMinute: minutesFromClock(row.localStartTime),
    endMinute: minutesFromClock(row.localEndTime),
    mode: row.mode,
    locationId: row.locationId,
    offeringId: row.offeringId,
    validFrom: row.validFrom ? row.validFrom.toISOString().slice(0, 10) : null,
    validUntil: row.validUntil ? row.validUntil.toISOString().slice(0, 10) : null,
    isActive: row.isActive,
  };
}

export async function loadDoctorRules(db: Db, doctorProfileId: string): Promise<ScheduleRule[]> {
  const rows = await db.doctorAvailabilityRule.findMany({
    where: { doctorProfileId, isActive: true },
  });
  return rows.map(toScheduleRule);
}

export async function loadBlockingIntervals(
  db: Db,
  input: { doctorProfileId: string; rangeStart: Date; rangeEnd: Date; now: Date; excludeAppointmentId?: string },
): Promise<TimeBlock[]> {
  const [timeOff, appointments] = await Promise.all([
    db.doctorTimeOff.findMany({
      where: {
        doctorProfileId: input.doctorProfileId,
        startsAt: { lt: input.rangeEnd },
        endsAt: { gt: input.rangeStart },
      },
      select: { startsAt: true, endsAt: true },
    }),
    db.appointment.findMany({
      where: {
        doctorProfileId: input.doctorProfileId,
        id: input.excludeAppointmentId ? { not: input.excludeAppointmentId } : undefined,
        startsAt: { lt: input.rangeEnd },
        endsAt: { gt: input.rangeStart },
        OR: [
          { status: { in: ["PENDING_APPROVAL", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] } },
          { status: "PENDING_PAYMENT", paymentHoldExpiresAt: { gt: input.now } },
        ],
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);
  return [...timeOff, ...appointments];
}

export const SLOT_OCCUPYING_STATUSES = OCCUPYING_APPOINTMENT_STATUSES;
