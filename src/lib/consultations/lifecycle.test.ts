import { describe, expect, it } from "vitest";
import { advanceDoctorAppointment } from "@/lib/appointments/booking";
import { applyConsultationSideEffects } from "./lifecycle";

const DOCTOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PATIENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APPOINTMENT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const START = new Date("2026-10-19T10:00:00.000Z");
const END = new Date("2026-10-19T10:30:00.000Z");
const NOW = new Date("2026-10-19T10:05:00.000Z");

function store(initial: string) {
  let status = initial;
  let updates = 0;
  let ended = 0;
  const audits: string[] = [];
  const db = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      appointment: {
        findUnique: async () => ({ id: APPOINTMENT, status, startsAt: START, endsAt: END, doctor: { userId: DOCTOR } }),
        updateMany: async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
          if (where.status !== status) return { count: 0 };
          status = data.status;
          updates += 1;
          return { count: 1 };
        },
      },
      appointmentEvent: { create: async () => ({}) },
      auditLog: { create: async () => ({}) },
    }),
    appointment: {
      findUnique: async () => ({ id: APPOINTMENT, mode: "ONLINE", status }),
    },
    encounter: {
      updateMany: async () => {
        ended += 1;
        return { count: 1 };
      },
    },
    auditLog: {
      create: async ({ data }: { data: { action: string } }) => {
        audits.push(data.action);
        return data;
      },
    },
  };
  return { db, audits, get status() { return status; }, get updates() { return updates; }, get ended() { return ended; } };
}

describe("consultation lifecycle", () => {
  it("lets the assigned doctor complete once and ignores a repeated completion", async () => {
    const current = store("IN_PROGRESS");
    const closed: string[] = [];
    const first = await advanceDoctorAppointment(
      { actorUserId: DOCTOR, appointmentId: APPOINTMENT, to: "COMPLETED" },
      { db: current.db as never, now: NOW },
    );
    expect(first.ok).toBe(true);
    await applyConsultationSideEffects(current.db as never, { actorUserId: DOCTOR, appointmentId: APPOINTMENT, to: "COMPLETED", now: NOW }, {
      closeRoom: async (roomName) => {
        closed.push(roomName);
      },
      notify: async () => undefined,
      openEncounter: async () => ({ ok: true, message: "open" }),
    });
    const second = await advanceDoctorAppointment(
      { actorUserId: DOCTOR, appointmentId: APPOINTMENT, to: "COMPLETED" },
      { db: current.db as never, now: NOW },
    );
    expect(second.ok).toBe(false);
    expect(current.updates).toBe(1);
    expect(current.ended).toBe(1);
    expect(closed).toEqual([`cc-apt-${APPOINTMENT}`]);
    expect(current.audits).toContain("consultation.completed");
  });

  it("does not let another user or a confirmed visit start the clinical encounter", async () => {
    const current = store("CHECKED_IN");
    const denied = await advanceDoctorAppointment(
      { actorUserId: PATIENT, appointmentId: APPOINTMENT, to: "IN_PROGRESS" },
      { db: current.db as never, now: NOW },
    );
    expect(denied).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(current.updates).toBe(0);

    const early = store("CONFIRMED");
    const blocked = await advanceDoctorAppointment(
      { actorUserId: DOCTOR, appointmentId: APPOINTMENT, to: "IN_PROGRESS" },
      { db: early.db as never, now: NOW },
    );
    expect(blocked.ok).toBe(false);

    let opened = 0;
    const ready = store("CHECKED_IN");
    const started = await advanceDoctorAppointment(
      { actorUserId: DOCTOR, appointmentId: APPOINTMENT, to: "IN_PROGRESS" },
      { db: ready.db as never, now: NOW },
    );
    expect(started.ok).toBe(true);
    await applyConsultationSideEffects(ready.db as never, { actorUserId: DOCTOR, appointmentId: APPOINTMENT, to: "IN_PROGRESS", now: NOW }, {
      openEncounter: async () => {
        opened += 1;
        return { ok: true, message: "open" };
      },
      notify: async () => undefined,
    });
    expect(opened).toBe(1);
    expect(ready.status).toBe("IN_PROGRESS");
    expect(ready.audits).toContain("consultation.started");
  });
});
