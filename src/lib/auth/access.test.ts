import { describe, expect, it } from "vitest";
import { nextAccountStatus, ownPatientScope, patientAccessDecision } from "./access";
import { readOwnPatientProfile } from "./current-user";
import { sessionCookieOptions } from "./session";

describe("account status and patient isolation", () => {
  it("blocks pending, suspended, and disabled accounts", () => {
    expect(
      patientAccessDecision({ status: "PENDING_VERIFICATION", deletedAt: null, roleCodes: ["PATIENT"] }),
    ).toBe("verify");
    expect(patientAccessDecision({ status: "SUSPENDED", deletedAt: null, roleCodes: ["PATIENT"] })).toBe(
      "unavailable",
    );
    expect(patientAccessDecision({ status: "DISABLED", deletedAt: null, roleCodes: ["PATIENT"] })).toBe(
      "unavailable",
    );
    expect(patientAccessDecision({ status: "ACTIVE", deletedAt: new Date(), roleCodes: ["PATIENT"] })).toBe(
      "unavailable",
    );
    expect(patientAccessDecision({ status: "ACTIVE", deletedAt: null, roleCodes: ["DOCTOR"] })).toBe(
      "unavailable",
    );
    expect(patientAccessDecision({ status: "ACTIVE", deletedAt: null, roleCodes: ["PATIENT"] })).toBe("allow");
  });

  it("activates only after a contact is verified and never reopens a suspended account", () => {
    expect(
      nextAccountStatus({ current: "PENDING_VERIFICATION", deleted: false, contactVerified: true }),
    ).toMatchObject({ status: "ACTIVE", openSession: true });
    expect(
      nextAccountStatus({ current: "PENDING_VERIFICATION", deleted: false, contactVerified: false }),
    ).toMatchObject({ status: "PENDING_VERIFICATION", openSession: false });
    expect(nextAccountStatus({ current: "SUSPENDED", deleted: false, contactVerified: true })).toMatchObject({
      status: "SUSPENDED",
      openSession: false,
      outcome: "unavailable",
    });
    expect(nextAccountStatus({ current: "DISABLED", deleted: false, contactVerified: true })).toMatchObject({
      status: "DISABLED",
      openSession: false,
    });
  });

  it("refuses another patient's profile id and does not query it", async () => {
    expect(ownPatientScope("patient-a", "patient-b")).toEqual({ allowed: false });
    expect(ownPatientScope("patient-a", "patient-a")).toEqual({ allowed: true, userId: "patient-a" });
    expect(ownPatientScope("patient-a")).toEqual({ allowed: true, userId: "patient-a" });

    const queries: string[] = [];
    const db = {
      patientProfile: {
        findUnique: async ({ where }: { where: { userId: string } }) => {
          queries.push(where.userId);
          return { id: "profile-a", userId: where.userId, firstName: "Aminata", lastName: "Kamara" };
        },
      },
    };
    const forbidden = await readOwnPatientProfile(db as never, "patient-a", "patient-b");
    expect(forbidden).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(queries).toEqual([]);
    const own = await readOwnPatientProfile(db as never, "patient-a");
    expect(own.ok).toBe(true);
    expect(queries).toEqual(["patient-a"]);
  });

  it("sets an HTTP-only session cookie", () => {
    expect(sessionCookieOptions(true)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});
