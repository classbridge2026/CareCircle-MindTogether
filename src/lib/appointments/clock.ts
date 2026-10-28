import { timingSafeEqual } from "node:crypto";
import { AppointmentStatus, type PrismaClient } from "@prisma/client";
import { retryDueNotices } from "@/lib/notifications/retry";
import { expireOverdueHolds } from "./payment-holds";
import { notifyAppointmentParties, type AppointmentNotice } from "./email-notice";

const REMINDER_STATUSES = [AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN];

/** Wide enough that an hourly run still catches each visit once. */
export function reminderRange(kind: "day" | "hour", now: Date): { from: Date; to: Date } {
  if (kind === "day") {
    return {
      from: new Date(now.getTime() + 22 * 60 * 60 * 1000),
      to: new Date(now.getTime() + 26 * 60 * 60 * 1000),
    };
  }
  return {
    from: new Date(now.getTime() + 15 * 60 * 1000),
    to: new Date(now.getTime() + 90 * 60 * 1000),
  };
}

export function appointmentClockAuthorized(authorization: string | null, secret: string | undefined): boolean {
  const expected = secret?.trim() ?? "";
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  const provided = authorization.slice("Bearer ".length).trim();
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

async function remindWindow(
  db: PrismaClient,
  kind: "day" | "hour",
  now: Date,
  notify: typeof notifyAppointmentParties,
): Promise<number> {
  const range = reminderRange(kind, now);
  const event: AppointmentNotice = kind === "day" ? "reminder_day" : "reminder_hour";
  const rows = await db.appointment.findMany({
    where: {
      status: { in: REMINDER_STATUSES },
      startsAt: { gte: range.from, lt: range.to },
    },
    select: { id: true },
  });
  for (const row of rows) {
    await notify(db, { appointmentId: row.id, event });
  }
  return rows.length;
}

export async function runAppointmentClock(
  db: PrismaClient,
  options: {
    now?: Date;
    expire?: (client: PrismaClient) => Promise<string[]>;
    notify?: typeof notifyAppointmentParties;
  } = {},
): Promise<{ expired: number; dayReminders: number; hourReminders: number; retried: number }> {
  const now = options.now ?? new Date();
  const expire = options.expire ?? ((client) => expireOverdueHolds(client));
  const notify = options.notify ?? notifyAppointmentParties;
  const expired = await expire(db);
  const dayReminders = await remindWindow(db, "day", now, notify);
  const hourReminders = await remindWindow(db, "hour", now, notify);
  const retried = await retryDueNotices(db, now);
  return { expired: expired.length, dayReminders, hourReminders, retried };
}
