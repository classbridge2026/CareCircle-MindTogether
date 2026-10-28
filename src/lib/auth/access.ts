import type { UserStatus } from "@prisma/client";
import { ADMIN_ROLE_CODE, DOCTOR_ROLE_CODE, PATIENT_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "./constants";

export type AppHome = "/patient" | "/doctor" | "/admin";

const ROLE_HOMES: Array<{ code: string; home: AppHome }> = [
  { code: SUPER_ADMIN_ROLE_CODE, home: "/admin" },
  { code: ADMIN_ROLE_CODE, home: "/admin" },
  { code: DOCTOR_ROLE_CODE, home: "/doctor" },
  { code: PATIENT_ROLE_CODE, home: "/patient" },
];

/** Highest stored role wins. The browser never supplies this choice. */
export function homeForRoles(roleCodes: string[]): AppHome | null {
  for (const entry of ROLE_HOMES) {
    if (roleCodes.includes(entry.code)) {
      return entry.home;
    }
  }
  return null;
}

export type AccessDecision = "allow" | "verify" | "unavailable";

export function patientAccessDecision(input: {
  status: UserStatus;
  deletedAt: Date | null;
  roleCodes: string[];
}): AccessDecision {
  if (input.deletedAt) {
    return "unavailable";
  }
  if (input.status === "SUSPENDED" || input.status === "DISABLED") {
    return "unavailable";
  }
  if (input.status === "PENDING_VERIFICATION") {
    return "verify";
  }
  if (input.status !== "ACTIVE" || !input.roleCodes.includes(PATIENT_ROLE_CODE)) {
    return "unavailable";
  }
  return "allow";
}

/** Patients can read only the profile tied to the signed-in user. */
export function ownPatientScope(
  actorUserId: string,
  requestedUserId?: string | null,
): { allowed: true; userId: string } | { allowed: false } {
  if (requestedUserId && requestedUserId !== actorUserId) {
    return { allowed: false };
  }
  return { allowed: true, userId: actorUserId };
}

export type ActivationOutcome = "activated" | "verified" | "unavailable";

export function nextAccountStatus(input: {
  current: UserStatus;
  deleted: boolean;
  contactVerified: boolean;
}): { status: UserStatus; openSession: boolean; outcome: ActivationOutcome } {
  if (input.deleted || input.current === "SUSPENDED" || input.current === "DISABLED") {
    return { status: input.current, openSession: false, outcome: "unavailable" };
  }
  if (input.current === "ACTIVE") {
    return { status: "ACTIVE", openSession: true, outcome: "verified" };
  }
  if (input.current === "PENDING_VERIFICATION" && input.contactVerified) {
    return { status: "ACTIVE", openSession: true, outcome: "activated" };
  }
  return { status: input.current, openSession: false, outcome: "verified" };
}
