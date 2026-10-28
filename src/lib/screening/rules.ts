import { SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";

export const SCREENING_CONSENT_VERSION = "2026-10-26";
export const SCREENING_SAFETY_SETTING = "SCREENING_SAFETY_CONTACTS";
export const INTERPRETATION_MAX = 2000;
export const FOLLOW_UP_MAX = 1000;
export const AMENDMENT_MAX = 500;

export const RESULT_DISCLAIMER =
  "This result is a screening score. It is not a diagnosis, and it does not recommend medication or decide whether you are safe.";

export type ScreeningCategoryCode =
  | "DEPRESSION"
  | "BIPOLAR"
  | "MANIA"
  | "ANXIETY"
  | "PSYCHOSIS"
  | "COGNITIVE"
  | "SUBSTANCE"
  | "OCD"
  | "PERSONALITY";

export type ToolGate = {
  approvalState: string;
  licenseStatus: string;
  availability: string;
  retiredAt: Date | null;
  safetyProtocolRequired: boolean;
  safetyProtocolApproved: boolean;
  hasItems: boolean;
  hasScoringSpec: boolean;
  hasSafetyContacts: boolean;
};

export type SafetyContact = { label: string; value: string };
export type SafetyContacts = { region: string; lines: SafetyContact[] };

const CATEGORY_ORDER: ScreeningCategoryCode[] = [
  "DEPRESSION",
  "BIPOLAR",
  "MANIA",
  "ANXIETY",
  "PSYCHOSIS",
  "COGNITIVE",
  "SUBSTANCE",
  "OCD",
  "PERSONALITY",
];

export function categoryOrder(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category as ScreeningCategoryCode);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

export function activationBlockers(tool: ToolGate): string[] {
  const blockers: string[] = [];
  if (tool.retiredAt || tool.approvalState === "RETIRED" || tool.availability === "RETIRED") {
    blockers.push("This instrument is retired.");
  }
  if (tool.approvalState !== "CLINICALLY_APPROVED") blockers.push("Clinical approval has not been recorded.");
  if (tool.licenseStatus !== "CLEARED_FOR_CLINICAL_USE") blockers.push("Licensing clearance has not been recorded.");
  if (!tool.hasItems) blockers.push("No approved question set is stored for this version.");
  if (!tool.hasScoringSpec) blockers.push("No approved scoring specification is stored for this version.");
  if (tool.safetyProtocolRequired && !tool.safetyProtocolApproved) {
    blockers.push("The clinical safety protocol has not been approved.");
  }
  if (tool.safetyProtocolRequired && !tool.hasSafetyContacts) {
    blockers.push("Verified local support contacts are not configured.");
  }
  return blockers;
}

export function patientCanStart(tool: ToolGate): boolean {
  return tool.availability === "ACTIVE" && activationBlockers(tool).length === 0;
}

export function nextAvailability(tool: ToolGate): "ACTIVE" | "INACTIVE" | "RETIRED" {
  if (tool.retiredAt || tool.approvalState === "RETIRED") return "RETIRED";
  return activationBlockers({ ...tool, availability: "INACTIVE", retiredAt: null, approvalState: tool.approvalState }).length === 0
    ? "ACTIVE"
    : "INACTIVE";
}

export function governanceChangeAllowed(roleCodes: string[]): boolean {
  return roleCodes.includes(SUPER_ADMIN_ROLE_CODE);
}

/** Scoring thresholds are never edited from an administration form. */
export function thresholdEditAllowed(): false {
  return false;
}

export function governancePayloadRejected(input: Record<string, unknown>): boolean {
  const blocked = ["scoringspec", "scoring", "threshold", "thresholds", "items", "questions", "band", "bands", "score"];
  return Object.keys(input).some((key) => blocked.includes(key.toLowerCase()));
}

export function patientOwns(actorUserId: string, ownerUserId: string): boolean {
  return actorUserId.length > 0 && actorUserId === ownerUserId;
}

export function doctorMayAccess(hasCareRelationship: boolean): boolean {
  return hasCareRelationship;
}

export function submitDecision(state: string): "accept" | "closed" | "reject" {
  if (state === "IN_PROGRESS") return "accept";
  if (state === "SUBMITTED") return "closed";
  return "reject";
}

export function startDecision(existingState: string | null): "resume" | "create" {
  return existingState === "IN_PROGRESS" ? "resume" : "create";
}

export function comparableAlgorithms(left: string | null, right: string | null): boolean {
  return Boolean(left && right && left === right);
}

export function snapshotItems<T>(items: T[]): T[] {
  return structuredClone(items);
}

export function patientResultView(input: {
  score: number;
  maxScore: number;
  band: string;
  algorithmVersion: string;
  completedAt: Date;
  interpretation?: string | null;
}): {
  score: number;
  maxScore: number;
  band: string;
  algorithmVersion: string;
  completedAt: Date;
  disclaimer: string;
} {
  return {
    score: input.score,
    maxScore: input.maxScore,
    band: input.band,
    algorithmVersion: input.algorithmVersion,
    completedAt: input.completedAt,
    disclaimer: RESULT_DISCLAIMER,
  };
}

export function boundedText(value: string, max: number): { ok: true; text: string } | { ok: false } {
  const text = value.replace(/\r\n/g, "\n").trim();
  if (!text || text.length > max) return { ok: false };
  return { ok: true, text };
}

export function isLicenseStatus(value: string): boolean {
  return ["NOT_REVIEWED", "RESTRICTION_UNRESOLVED", "CLEARED_FOR_CLINICAL_USE", "PROHIBITED"].includes(value);
}

export function isApprovalState(value: string): boolean {
  return ["PENDING_CLINICAL_REVIEW", "CLINICALLY_APPROVED", "REJECTED", "RETIRED"].includes(value);
}

const SUPPORT_PHONE = /^[+0-9()\s.-]{3,80}$/;

function supportText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** One verified local service. The phone number is shown only after a safety flag. */
export function supportContactDraft(input: { region: string; serviceName: string; phone: string }): SafetyContacts | null {
  const region = supportText(input.region);
  const label = supportText(input.serviceName);
  const phone = input.phone.trim();
  const digits = phone.replace(/\D/g, "");
  if (region.length < 2 || region.length > 80 || label.length < 2 || label.length > 80) return null;
  if (digits.length < 3 || digits.length > 20 || !SUPPORT_PHONE.test(phone)) return null;
  return { region, lines: [{ label, value: phone }] };
}

export function parseSafetyContacts(value: unknown): SafetyContacts | null {
  if (!value || typeof value !== "object") return null;
  const region = "region" in value && typeof value.region === "string" ? value.region.trim() : "";
  const lines = "lines" in value && Array.isArray(value.lines) ? value.lines : null;
  if (!region || region.length > 80 || !lines || lines.length === 0 || lines.length > 6) return null;
  const parsed: SafetyContact[] = [];
  for (const line of lines) {
    if (!line || typeof line !== "object") return null;
    const label = "label" in line && typeof line.label === "string" ? line.label.trim() : "";
    const contact = "value" in line && typeof line.value === "string" ? line.value.trim() : "";
    if (!label || !contact || label.length > 80 || contact.length > 80) return null;
    parsed.push({ label, value: contact });
  }
  return { region, lines: parsed };
}

export function safetyPresentation(flag: boolean, contacts: SafetyContacts | null):
  | { kind: "none" }
  | { kind: "blocked" }
  | { kind: "show"; contacts: SafetyContacts } {
  if (!flag) return { kind: "none" };
  if (!contacts) return { kind: "blocked" };
  return { kind: "show", contacts };
}
