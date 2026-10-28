import { describe, expect, it } from "vitest";
import {
  careAuthorization,
  clinicalFileDecision,
  clinicalStorageKey,
  clinicalWriteBlock,
  clinicianMayDocument,
  consentState,
  guardianIsAuthorized,
  noteChange,
  parseClinicalBody,
  requiresGuardianAuthorization,
  visitAllowsClinicalRecord,
} from "./rules";

const now = new Date("2026-10-18T12:00:00.000Z");

describe("clinical record permissions", () => {
  it("opens a record only for an in-progress or completed visit by an approved clinician", () => {
    expect(visitAllowsClinicalRecord("IN_PROGRESS")).toBe(true);
    expect(visitAllowsClinicalRecord("COMPLETED")).toBe(true);
    expect(visitAllowsClinicalRecord("CONFIRMED")).toBe(false);
    expect(visitAllowsClinicalRecord("NO_SHOW")).toBe(false);
    expect(clinicianMayDocument({ verificationStatus: "APPROVED", userStatus: "ACTIVE", deletedAt: null })).toBe(true);
    expect(clinicianMayDocument({ verificationStatus: "SUSPENDED", userStatus: "ACTIVE", deletedAt: null })).toBe(false);
  });

  it("requires a current privacy notice and blocks withdrawn processing or telehealth consent", () => {
    expect(
      careAuthorization({
        privacy: "active",
        dataProcessing: "absent",
        telehealth: "absent",
        mode: "ONLINE",
        requiresGuardian: false,
        minorTreatmentEnabled: false,
        guardianAuthorized: false,
      }).ok,
    ).toBe(true);
    expect(
      careAuthorization({
        privacy: "withdrawn",
        dataProcessing: "active",
        telehealth: "active",
        mode: "IN_PERSON",
        requiresGuardian: false,
        minorTreatmentEnabled: true,
        guardianAuthorized: true,
      }),
    ).toEqual({ ok: false, reason: "privacy" });
    expect(
      careAuthorization({
        privacy: "active",
        dataProcessing: "withdrawn",
        telehealth: "active",
        mode: "IN_PERSON",
        requiresGuardian: false,
        minorTreatmentEnabled: true,
        guardianAuthorized: true,
      }).ok,
    ).toBe(false);
    const online = careAuthorization({
      privacy: "active",
      dataProcessing: "absent",
      telehealth: "withdrawn",
      mode: "ONLINE",
      requiresGuardian: false,
      minorTreatmentEnabled: false,
      guardianAuthorized: false,
    });
    expect(online).toEqual({ ok: false, reason: "telehealth" });
  });

  it("blocks dependent and minor care until treatment is enabled and a guardian is authorized", () => {
    expect(requiresGuardianAuthorization({ isDependent: true, dateOfBirth: null, now })).toBe(true);
    expect(requiresGuardianAuthorization({ isDependent: false, dateOfBirth: "2012-01-01", now })).toBe(true);
    expect(requiresGuardianAuthorization({ isDependent: false, dateOfBirth: "1990-01-01", now })).toBe(false);
    expect(requiresGuardianAuthorization({ isDependent: false, dateOfBirth: null, now })).toBe(false);
    expect(consentState([])).toBe("absent");
    expect(consentState([{ withdrawnAt: new Date() }])).toBe("withdrawn");
    expect(consentState([{ withdrawnAt: new Date() }, { withdrawnAt: null }])).toBe("active");
    expect(guardianIsAuthorized({ status: "AUTHORIZED", revokedAt: null, guardianConsent: "active" })).toBe(true);
    expect(guardianIsAuthorized({ status: "PENDING", revokedAt: null, guardianConsent: "active" })).toBe(false);
    expect(guardianIsAuthorized({ status: "AUTHORIZED", revokedAt: null, guardianConsent: "absent" })).toBe(false);
    expect(
      careAuthorization({
        privacy: "active",
        dataProcessing: "absent",
        telehealth: "absent",
        mode: "IN_PERSON",
        requiresGuardian: true,
        minorTreatmentEnabled: false,
        guardianAuthorized: true,
      }),
    ).toEqual({ ok: false, reason: "minor_treatment" });
    expect(
      careAuthorization({
        privacy: "active",
        dataProcessing: "absent",
        telehealth: "absent",
        mode: "IN_PERSON",
        requiresGuardian: true,
        minorTreatmentEnabled: true,
        guardianAuthorized: false,
      }),
    ).toEqual({ ok: false, reason: "guardian" });
  });

  it("keeps working notes private and preserves released summary text until withdrawal", () => {
    expect(parseClinicalBody("  Follow up in two weeks.  ")).toEqual({ ok: true, body: "Follow up in two weeks." });
    expect(parseClinicalBody("   ").ok).toBe(false);
    expect(
      noteChange({
        kind: "PRIVATE_WORKING",
        summaryReleaseStatus: "NOT_RELEASED",
        archivedAt: null,
        legalHold: false,
        action: "release",
      }).ok,
    ).toBe(false);
    expect(
      noteChange({
        kind: "PATIENT_SUMMARY",
        summaryReleaseStatus: "RELEASED",
        archivedAt: null,
        legalHold: false,
        action: "revise",
      }).ok,
    ).toBe(false);
    expect(
      noteChange({
        kind: "PATIENT_SUMMARY",
        summaryReleaseStatus: "RELEASED",
        archivedAt: null,
        legalHold: false,
        action: "withdraw",
      }).ok,
    ).toBe(true);
    expect(
      noteChange({
        kind: "PATIENT_SUMMARY",
        summaryReleaseStatus: "RELEASED",
        archivedAt: null,
        legalHold: false,
        action: "archive",
      }).ok,
    ).toBe(false);
    expect(
      noteChange({
        kind: "PRIVATE_WORKING",
        summaryReleaseStatus: "NOT_RELEASED",
        archivedAt: null,
        legalHold: true,
        action: "archive",
      }).ok,
    ).toBe(false);
    expect(
      clinicalWriteBlock({
        doctorApproved: true,
        appointmentStatus: "COMPLETED",
        patientArchived: false,
        encounterArchived: false,
        encounterLegalHold: false,
        care: { ok: false, reason: "guardian" },
      }),
    ).toMatch(/authorized guardian/);
  });

  it("gives patients only released summary attachments and clinicians only their own files", () => {
    const released = { kind: "PATIENT_SUMMARY", summaryReleaseStatus: "RELEASED", archivedAt: null };
    expect(
      clinicalFileDecision({
        actorUserId: "patient",
        purpose: "CLINICAL_ATTACHMENT",
        patientUserId: "patient",
        doctorUserId: "doctor",
        doctorMayDocument: true,
        encounterArchived: false,
        note: released,
      }),
    ).toBe("patient");
    expect(
      clinicalFileDecision({
        actorUserId: "patient",
        purpose: "CLINICAL_ATTACHMENT",
        patientUserId: "patient",
        doctorUserId: "doctor",
        doctorMayDocument: true,
        encounterArchived: false,
        note: { kind: "PRIVATE_WORKING", summaryReleaseStatus: "NOT_RELEASED", archivedAt: null },
      }),
    ).toBe("deny");
    expect(
      clinicalFileDecision({
        actorUserId: "other-doctor",
        purpose: "CLINICAL_ATTACHMENT",
        patientUserId: "patient",
        doctorUserId: "doctor",
        doctorMayDocument: true,
        encounterArchived: false,
        note: released,
      }),
    ).toBe("deny");
    expect(
      clinicalFileDecision({
        actorUserId: "doctor",
        purpose: "CREDENTIAL",
        patientUserId: "patient",
        doctorUserId: "doctor",
        doctorMayDocument: true,
        encounterArchived: false,
        note: null,
      }),
    ).toBe("deny");
    expect(clinicalStorageKey("33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444")).toBe(
      "clinical-records/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444",
    );
    expect(() => clinicalStorageKey("../etc", "44444444-4444-4444-8444-444444444444")).toThrow();
  });
});
