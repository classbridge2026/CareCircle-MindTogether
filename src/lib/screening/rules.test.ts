import { describe, expect, it } from "vitest";
import {
  activationBlockers,
  comparableAlgorithms,
  governanceChangeAllowed,
  governancePayloadRejected,
  nextAvailability,
  patientCanStart,
  patientOwns,
  patientResultView,
  safetyPresentation,
  supportContactDraft,
  snapshotItems,
  startDecision,
  submitDecision,
  thresholdEditAllowed,
  type ToolGate,
} from "./rules";
import { answersMatchItems, parseScoringSpec, scoreAssessment, type ScreeningItem } from "./scoring";

const open: ToolGate = {
  approvalState: "CLINICALLY_APPROVED",
  licenseStatus: "CLEARED_FOR_CLINICAL_USE",
  availability: "ACTIVE",
  retiredAt: null,
  safetyProtocolRequired: true,
  safetyProtocolApproved: true,
  hasItems: true,
  hasScoringSpec: true,
  hasSafetyContacts: true,
};

const spec = parseScoringSpec({
  kind: "SUM",
  items: [
    { index: 0, min: 0, max: 3 },
    { index: 1, min: 0, max: 3 },
  ],
  bands: [
    { min: 0, max: 2, label: "Lower" },
    { min: 3, max: 6, label: "Higher" },
  ],
  safety: { itemIndex: 1, whenAtLeast: 2 },
});

const items: ScreeningItem[] = [
  { index: 0, prompt: "First synthetic item", choices: [{ value: 0, label: "No" }, { value: 1, label: "Yes" }, { value: 2, label: "More" }, { value: 3, label: "Most" }] },
  { index: 1, prompt: "Second synthetic item", choices: [{ value: 0, label: "No" }, { value: 1, label: "Yes" }, { value: 2, label: "More" }, { value: 3, label: "Most" }] },
];

describe("screening gates", () => {
  it("keeps an unapproved instrument closed", () => {
    const pending = { ...open, approvalState: "PENDING_CLINICAL_REVIEW", availability: "INACTIVE", licenseStatus: "NOT_REVIEWED", hasItems: false, hasScoringSpec: false, safetyProtocolApproved: false, hasSafetyContacts: false };
    expect(patientCanStart(pending)).toBe(false);
    expect(activationBlockers(pending)).toEqual([
      "Clinical approval has not been recorded.",
      "Licensing clearance has not been recorded.",
      "No approved question set is stored for this version.",
      "No approved scoring specification is stored for this version.",
      "The clinical safety protocol has not been approved.",
      "Verified local support contacts are not configured.",
    ]);
  });

  it("does not activate when the stored row says active but the rules are missing", () => {
    expect(patientCanStart({ ...open, hasScoringSpec: false })).toBe(false);
    expect(nextAvailability({ ...open, hasScoringSpec: false, availability: "INACTIVE" })).toBe("INACTIVE");
  });

  it("activates only when every approval is present", () => {
    expect(patientCanStart(open)).toBe(true);
    expect(nextAvailability({ ...open, availability: "INACTIVE" })).toBe("ACTIVE");
  });

  it("refuses threshold edits from every role", () => {
    expect(thresholdEditAllowed()).toBe(false);
    expect(governanceChangeAllowed(["ADMIN"])).toBe(false);
    expect(governanceChangeAllowed(["SUPER_ADMIN"])).toBe(true);
    expect(governancePayloadRejected({ scoringSpec: {} })).toBe(true);
    expect(governancePayloadRejected({ licenseStatus: "NOT_REVIEWED" })).toBe(false);
  });
});

describe("screening scores", () => {
  it("scores only the approved specification", () => {
    expect(spec).not.toBeNull();
    expect(scoreAssessment(spec!, [1, 1])).toEqual({ score: 2, maxScore: 6, band: "Lower", safetyFlag: false });
    expect(scoreAssessment(spec!, [3, 3])).toEqual({ score: 6, maxScore: 6, band: "Higher", safetyFlag: true });
  });

  it("rejects missing, extra, and out-of-range answers", () => {
    expect(scoreAssessment(spec!, [1])).toBeNull();
    expect(scoreAssessment(spec!, [1, 1, 1])).toBeNull();
    expect(scoreAssessment(spec!, [1, 4])).toBeNull();
    expect(answersMatchItems(items, spec!, [1, 9])).toBe(false);
    expect(answersMatchItems(items, spec!, [1, 2])).toBe(true);
  });

  it("does not invent a band outside the specification", () => {
    const narrow = parseScoringSpec({
      kind: "SUM",
      items: [{ index: 0, min: 0, max: 3 }],
      bands: [{ min: 0, max: 1, label: "Only this" }],
    });
    expect(scoreAssessment(narrow!, [3])).toBeNull();
  });
});

describe("screening privacy and history", () => {
  it("limits a patient to their own assessment and hides clinician notes", () => {
    expect(patientOwns("patient-1", "patient-1")).toBe(true);
    expect(patientOwns("patient-1", "patient-2")).toBe(false);
    const view = patientResultView({ score: 2, maxScore: 6, band: "Lower", algorithmVersion: "1", completedAt: new Date("2026-10-26T00:00:00Z"), interpretation: "private note" });
    expect(view).not.toHaveProperty("interpretation");
    expect(view.disclaimer).toMatch(/not a diagnosis/i);
  });

  it("resumes one in-progress assessment and rejects a second submission", () => {
    expect(startDecision("IN_PROGRESS")).toBe("resume");
    expect(startDecision(null)).toBe("create");
    expect(submitDecision("IN_PROGRESS")).toBe("accept");
    expect(submitDecision("SUBMITTED")).toBe("closed");
  });

  it("keeps a submitted snapshot independent of a later instrument edit", () => {
    const source = [{ prompt: "Original" }];
    const copy = snapshotItems(source);
    source[0].prompt = "Changed";
    expect(copy[0].prompt).toBe("Original");
  });

  it("compares history only when the algorithm version matches", () => {
    expect(comparableAlgorithms("sum-1", "sum-1")).toBe(true);
    expect(comparableAlgorithms("sum-1", "sum-2")).toBe(false);
    expect(comparableAlgorithms(null, "sum-1")).toBe(false);
  });

  it("accepts one service name and phone number", () => {
    expect(supportContactDraft({ region: "Freetown", serviceName: "Hospital emergency", phone: "+232 76 000 000" })).toEqual({
      region: "Freetown",
      lines: [{ label: "Hospital emergency", value: "+232 76 000 000" }],
    });
    expect(supportContactDraft({ region: "Freetown", serviceName: "Hospital", phone: "call me" })).toBeNull();
    expect(supportContactDraft({ region: "", serviceName: "Hospital", phone: "123" })).toBeNull();
  });

  it("does not present a safety pathway without configured contacts", () => {
    expect(safetyPresentation(true, null)).toEqual({ kind: "blocked" });
    expect(safetyPresentation(false, null)).toEqual({ kind: "none" });
    expect(safetyPresentation(true, { region: "Freetown", lines: [{ label: "Clinic", value: "000" }] }).kind).toBe("show");
  });
});
