import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { appointmentClockAuthorized, reminderRange, runAppointmentClock } from "./clock";

describe("appointment clock", () => {
  it("places the day reminder about a day ahead and the hour reminder inside the next 90 minutes", () => {
    const now = new Date("2026-10-24T12:00:00.000Z");
    const day = reminderRange("day", now);
    const hour = reminderRange("hour", now);
    expect(day.from.toISOString()).toBe("2026-10-25T10:00:00.000Z");
    expect(day.to.toISOString()).toBe("2026-10-25T14:00:00.000Z");
    expect(hour.from.toISOString()).toBe("2026-10-24T12:15:00.000Z");
    expect(hour.to.toISOString()).toBe("2026-10-24T13:30:00.000Z");
  });

  it("accepts only a bearer token that matches the secret", () => {
    expect(appointmentClockAuthorized(null, "clock-secret")).toBe(false);
    expect(appointmentClockAuthorized("Bearer clock-secret", undefined)).toBe(false);
    expect(appointmentClockAuthorized("Bearer wrong-secret", "clock-secret")).toBe(false);
    expect(appointmentClockAuthorized("Bearer clock-secret", "clock-secret")).toBe(true);
  });

  it("expires holds and reminds the visits that fall in each window", async () => {
    const now = new Date("2026-10-24T12:00:00.000Z");
    const queries: string[] = [];
    const events: string[] = [];
    const db = {
      appointment: {
        findMany: async ({ where }: { where: { startsAt: { gte: Date } } }) => {
          const day = where.startsAt.gte.getTime() > now.getTime() + 60 * 60 * 1000;
          queries.push(day ? "day" : "hour");
          return [{ id: day ? "day-visit" : "hour-visit" }];
        },
      },
    };
    const result = await runAppointmentClock(db as unknown as PrismaClient, {
      now,
      expire: async () => ["hold-1", "hold-2"],
      notify: async (_db, input) => {
        events.push(`${input.event}:${input.appointmentId}`);
      },
    });
    expect(result).toEqual({ expired: 2, dayReminders: 1, hourReminders: 1, retried: 0 });
    expect(queries).toEqual(["day", "hour"]);
    expect(events).toEqual(["reminder_day:day-visit", "reminder_hour:hour-visit"]);
  });
});
