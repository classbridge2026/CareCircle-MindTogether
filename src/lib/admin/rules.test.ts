import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/delivery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/delivery")>("@/lib/auth/delivery");
  return {
    ...actual,
    sendCareCircleEmail: vi.fn(async () => ({ delivered: false, reason: "not_configured" as const })),
  };
});
import { ADMIN_ROLE_CODE, DOCTOR_ROLE_CODE, PATIENT_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { cancelAppointmentAsAdmin, changeElevatedRole, changeUserAccountStatus } from "./mutations";
import {
  accountStatusDecision,
  adminCancelDecision,
  freetownDayBounds,
  parseFreetownDate,
  parseHoldMinutes,
  parseReportRange,
  reconciliationFlags,
  roleChangeDecision,
  sanitizeMetadata,
} from "./rules";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const appointmentId = "33333333-3333-4333-8333-333333333333";

describe("administrator role changes", () => {
  const base = {
    actorId,
    targetId,
    targetRoles: ["PATIENT"],
    activeSuperAdminCount: 2,
    targetIsActiveSuperAdmin: false,
  };

  it("rejects patient, doctor, and ordinary administrator role changes", () => {
    for (const actorRoles of [[PATIENT_ROLE_CODE], [DOCTOR_ROLE_CODE], [ADMIN_ROLE_CODE]]) {
      expect(
        roleChangeDecision({ ...base, actorRoles, roleCode: ADMIN_ROLE_CODE, change: "grant" }).ok,
      ).toBe(false);
    }
  });

  it("rejects self grants and patient or doctor role assignment", () => {
    expect(
      roleChangeDecision({
        ...base,
        actorId: targetId,
        actorRoles: [SUPER_ADMIN_ROLE_CODE],
        roleCode: SUPER_ADMIN_ROLE_CODE,
        change: "grant",
      }),
    ).toEqual({ ok: false, code: "SELF" });
    expect(
      roleChangeDecision({ ...base, actorRoles: [SUPER_ADMIN_ROLE_CODE], roleCode: PATIENT_ROLE_CODE, change: "grant" }).ok,
    ).toBe(false);
    expect(
      roleChangeDecision({ ...base, actorRoles: [SUPER_ADMIN_ROLE_CODE], roleCode: DOCTOR_ROLE_CODE, change: "grant" }).ok,
    ).toBe(false);
  });

  it("keeps the last active super administrator", () => {
    expect(
      roleChangeDecision({
        actorId,
        actorRoles: [SUPER_ADMIN_ROLE_CODE],
        targetId,
        targetRoles: [SUPER_ADMIN_ROLE_CODE],
        roleCode: SUPER_ADMIN_ROLE_CODE,
        change: "revoke",
        activeSuperAdminCount: 1,
        targetIsActiveSuperAdmin: true,
      }),
    ).toEqual({ ok: false, code: "LAST_SUPER_ADMIN" });
  });
});

describe("account status", () => {
  it("lets an administrator suspend a patient and blocks self or elevated targets", () => {
    expect(
      accountStatusDecision({
        actorId,
        actorRoles: [ADMIN_ROLE_CODE],
        targetId,
        targetStatus: "ACTIVE",
        targetDeleted: false,
        targetRoles: [PATIENT_ROLE_CODE],
        change: "suspend",
        activeSuperAdminCount: 1,
      }).ok,
    ).toBe(true);
    expect(
      accountStatusDecision({
        actorId,
        actorRoles: [ADMIN_ROLE_CODE],
        targetId,
        targetStatus: "ACTIVE",
        targetDeleted: false,
        targetRoles: [ADMIN_ROLE_CODE],
        change: "suspend",
        activeSuperAdminCount: 2,
      }),
    ).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(
      accountStatusDecision({
        actorId: targetId,
        actorRoles: [SUPER_ADMIN_ROLE_CODE],
        targetId,
        targetStatus: "ACTIVE",
        targetDeleted: false,
        targetRoles: [SUPER_ADMIN_ROLE_CODE],
        change: "suspend",
        activeSuperAdminCount: 1,
      }),
    ).toEqual({ ok: false, code: "SELF" });
  });

  it("does not reactivate a pending account", () => {
    expect(
      accountStatusDecision({
        actorId,
        actorRoles: [SUPER_ADMIN_ROLE_CODE],
        targetId,
        targetStatus: "PENDING_VERIFICATION",
        targetDeleted: false,
        targetRoles: [PATIENT_ROLE_CODE],
        change: "reactivate",
        activeSuperAdminCount: 1,
      }),
    ).toEqual({ ok: false, code: "UNSUPPORTED" });
  });
});

describe("appointment and payment rules", () => {
  it("cancels only occupying appointments", () => {
    expect(adminCancelDecision("CONFIRMED")).toBe(true);
    expect(adminCancelDecision("PENDING_PAYMENT")).toBe(true);
    expect(adminCancelDecision("COMPLETED")).toBe(false);
    expect(adminCancelDecision("EXPIRED_UNPAID")).toBe(false);
    expect(adminCancelDecision("CANCELLED_BY_PATIENT")).toBe(false);
  });

  it("flags a paid appointment whose hold has already been released", () => {
    expect(
      reconciliationFlags({
        paymentStatus: "PAID",
        appointmentStatus: "EXPIRED_UNPAID",
        providerReference: "ref",
        latestEventStatus: "PAID",
      }),
    ).toContain("late_payment_after_released_hold");
  });

  it("limits the payment hold and report range", () => {
    expect(parseHoldMinutes("10")).toBe(10);
    expect(parseHoldMinutes("4")).toBeNull();
    expect(parseHoldMinutes("121")).toBeNull();
    expect(parseFreetownDate("2026-02-31")).toBeNull();
    const day = freetownDayBounds(new Date("2026-10-18T23:30:00.000Z"));
    expect(day.start.toISOString()).toBe("2026-10-18T00:00:00.000Z");
    expect(parseReportRange("2020-01-01", "2026-01-01", new Date("2026-10-18T00:00:00.000Z"))).toEqual({
      error: "Choose a range of 366 days or fewer.",
    });
  });
});

describe("audit metadata", () => {
  it("drops secrets and keeps operational fields", () => {
    expect(sanitizeMetadata({ reason: "Slot released", passwordHash: "nope", token: "raw" })).toEqual({ reason: "Slot released" });
    expect(sanitizeMetadata(["nope"])).toBeNull();
  });
});

describe("admin mutations", () => {
  function memory(
    users: Record<string, { id: string; status: string; deletedAt: Date | null; roles: Array<{ role: { code: string } }> }>,
    extras?: { appointmentStatus?: string; superCount?: number; withParties?: boolean },
  ) {
    const audits: Array<{ action?: string }> = [];
    const notes: Array<Record<string, unknown>> = [];
    let transactions = 0;
    const party = {
      patient: {
        userId: "patient-user",
        user: { email: "patient@example.com", phoneE164: "+23276111222", status: "ACTIVE", deletedAt: null },
      },
      doctor: {
        userId: "doctor-user",
        user: { email: "doctor@example.com", phoneE164: "+23276111333", status: "ACTIVE", deletedAt: null },
      },
    };
    const api = {
      user: {
        findUnique: async ({ where }: { where: { id?: string; emailNormalized?: string } }) =>
          (where.id ? users[where.id] : Object.values(users).find((user) => user.id === where.emailNormalized)) ?? null,
        update: async () => ({}),
      },
      userRole: {
        count: async () => extras?.superCount ?? 2,
        deleteMany: async () => ({ count: 1 }),
        create: async () => ({}),
      },
      role: { findUnique: async () => ({ id: "role-id" }) },
      session: { updateMany: async () => ({ count: 1 }) },
      auditLog: { create: async ({ data }: { data: { action?: string } }) => void audits.push(data) },
      appointment: {
        findUnique: async () =>
          extras?.appointmentStatus
            ? { id: appointmentId, status: extras.appointmentStatus, startsAt: new Date("2026-10-19T09:00:00.000Z"), ...(extras.withParties ? party : {}) }
            : null,
        updateMany: async () => ({ count: 1 }),
      },
      appointmentEvent: { create: async () => ({}) },
      platformSetting: { findUnique: async () => null },
      notification: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          notes.push(data);
        },
      },
      $transaction: async (fn: (tx: object) => Promise<unknown>) => {
        transactions += 1;
        return fn(api);
      },
      audits,
      notes,
      transactions: () => transactions,
    };
    return api;
  }

  it("does not open a transaction for an unauthorized role change", async () => {
    const db = memory({});
    const result = await changeElevatedRole(
      { userId: targetId, roleCode: SUPER_ADMIN_ROLE_CODE, change: "grant" },
      { db: db as never, actor: { userId: actorId, roleCodes: [ADMIN_ROLE_CODE] } },
    );
    expect(result.ok).toBe(false);
    expect(db.transactions()).toBe(0);
  });

  it("suspends a patient and writes an audit event", async () => {
    const db = memory({
      [targetId]: { id: targetId, status: "ACTIVE", deletedAt: null, roles: [{ role: { code: PATIENT_ROLE_CODE } }] },
    });
    const result = await changeUserAccountStatus(
      { userId: targetId, change: "suspend", reason: "Account review after a support request." },
      { db: db as never, actor: { userId: actorId, roleCodes: [ADMIN_ROLE_CODE] } },
    );
    expect(result.ok).toBe(true);
    expect(db.audits.map((audit) => audit.action)).toContain("user.suspended");
  });

  it("does not cancel a completed appointment", async () => {
    const db = memory({}, { appointmentStatus: "COMPLETED" });
    const result = await cancelAppointmentAsAdmin(
      { appointmentId, reason: "This should not be accepted." },
      { db: db as never, actor: { userId: actorId, roleCodes: [ADMIN_ROLE_CODE] } },
    );
    expect(result.ok).toBe(false);
    expect(db.transactions()).toBe(0);
    expect(db.audits).toHaveLength(0);
  });

  it("cancels a confirmed appointment with an audit event", async () => {
    const db = memory({}, { appointmentStatus: "CONFIRMED" });
    const result = await cancelAppointmentAsAdmin(
      { appointmentId, reason: "Doctor is unavailable and the visit cannot proceed." },
      { db: db as never, actor: { userId: actorId, roleCodes: [SUPER_ADMIN_ROLE_CODE] } },
    );
    expect(result.ok).toBe(true);
    expect(db.audits.map((audit) => audit.action)).toContain("appointment.cancelled_by_admin");
  });

  it("tells the patient and the doctor when an administrator cancels", async () => {
    const db = memory({}, { appointmentStatus: "CONFIRMED", withParties: true });
    const result = await cancelAppointmentAsAdmin(
      { appointmentId, reason: "Doctor is unavailable and the visit cannot proceed." },
      { db: db as never, actor: { userId: actorId, roleCodes: [SUPER_ADMIN_ROLE_CODE] } },
    );
    expect(result.ok).toBe(true);
    const inApp = db.notes.filter((row) => row.channel === "IN_APP" && row.type === "appointment.cancelled");
    expect(inApp).toHaveLength(2);
    expect(inApp.map((row) => row.recipientId).sort()).toEqual(["doctor-user", "patient-user"]);
    expect(JSON.stringify(db.notes)).not.toContain("Doctor is unavailable");
  });
});
