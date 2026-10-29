import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { completeEndedConsultations, consultationHasEnded, shownAppointmentStatus } from "./finish";

describe("finished consultations", () => {
  const start = new Date("2026-10-29T09:00:00.000Z");
  const end = new Date("2026-10-29T09:30:00.000Z");

  it("treats an in-progress visit as over only after its end time", () => {
    expect(consultationHasEnded("IN_PROGRESS", end, end)).toBe(true);
    expect(consultationHasEnded("IN_PROGRESS", end, new Date(end.getTime() - 1))).toBe(false);
    expect(consultationHasEnded("CONFIRMED", end, end)).toBe(false);
    expect(shownAppointmentStatus("IN_PROGRESS", end, end)).toBe("COMPLETED");
    expect(shownAppointmentStatus("IN_PROGRESS", end, start)).toBe("IN_PROGRESS");
  });

  it("completes only the in-progress visits whose end time has passed", async () => {
    const where: Array<Record<string, unknown>> = [];
    const completed: string[] = [];
    const db = {
      appointment: {
        findMany: async ({ where: filter }: { where: Record<string, unknown> }) => {
          where.push(filter);
          return [{ id: "apt-1", doctor: { userId: "doctor-user" } }];
        },
      },
    };
    const count = await completeEndedConsultations(db as unknown as PrismaClient, { now: end, doctorProfileId: "doctor-1" }, {
      advance: async (input) => {
        completed.push(`${input.appointmentId}:${input.to}`);
        return { ok: true as const, appointmentId: input.appointmentId };
      },
      effects: async () => undefined,
    });
    expect(count).toBe(1);
    expect(completed).toEqual(["apt-1:COMPLETED"]);
    expect(where[0]).toMatchObject({ status: "IN_PROGRESS", doctorProfileId: "doctor-1", endsAt: { lte: end } });
  });
});