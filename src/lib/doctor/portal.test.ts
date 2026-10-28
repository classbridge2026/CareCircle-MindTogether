import { describe, expect, it } from "vitest";
import { assignedGuardianLabel, isFollowUpConsultation, platformDayStart } from "./portal";

describe("doctor portal", () => {
  it("recognises follow-up consultations from the service code or name", () => {
    expect(isFollowUpConsultation({ code: "FOLLOW_UP", name: "Review" })).toBe(true);
    expect(isFollowUpConsultation({ code: "INITIAL", name: "Follow-up visit" })).toBe(true);
    expect(isFollowUpConsultation({ code: "INITIAL", name: "Initial consultation" })).toBe(false);
  });

  it("starts the schedule day at midnight in Freetown", () => {
    expect(platformDayStart(new Date("2026-10-18T23:30:00.000Z")).toISOString()).toBe("2026-10-18T00:00:00.000Z");
  });

  it("describes guardian authorization without relationship notes", () => {
    expect(assignedGuardianLabel([])).toBe("Not recorded");
    expect(
      assignedGuardianLabel([
        { status: "AUTHORIZED", revokedAt: null, relationshipType: "PARENT" },
        { status: "PENDING", revokedAt: null, relationshipType: "LEGAL_GUARDIAN" },
      ]),
    ).toBe("Parent · Authorized; Legal guardian · Pending");
    expect(assignedGuardianLabel([{ status: "AUTHORIZED", revokedAt: new Date(), relationshipType: "PARENT" }])).toBe("Parent · Revoked");
  });
});
