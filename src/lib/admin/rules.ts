import { ADMIN_ROLE_CODE, DOCTOR_ROLE_CODE, PATIENT_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";

export const PLATFORM_TIMEZONE = "Africa/Freetown";
export const ADMIN_PAGE_SIZE = 20;
export const HOLD_MINUTES_MIN = 5;
export const HOLD_MINUTES_MAX = 120;
export const REPORT_MAX_DAYS = 366;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BLOCKED_METADATA = /password|token|secret|hash|cvv|card|pan|credential/i;

export const ELEVATED_ROLE_CODES = [ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE] as const;
export const DIRECTORY_ROLE_CODES = [PATIENT_ROLE_CODE, DOCTOR_ROLE_CODE, ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE] as const;

export const OCCUPYING_APPOINTMENT_STATUSES = ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] as const;
export const CANCELLED_APPOINTMENT_STATUSES = ["CANCELLED_BY_PATIENT", "CANCELLED_BY_DOCTOR", "CANCELLED_BY_ADMIN"] as const;
export const UPCOMING_APPOINTMENT_STATUSES = ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] as const;
export const FAILED_PAYMENT_STATUSES = ["FAILED", "REFUNDED", "PARTIALLY_REFUNDED"] as const;
export const CONFIRMED_VISIT_STATUSES = ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"] as const;

const USER_STATUSES = ["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DISABLED"] as const;
const APPOINTMENT_STATUSES = [
  "PENDING_PAYMENT",
  "EXPIRED_UNPAID",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_DOCTOR",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW",
  "RESCHEDULED",
] as const;
const PAYMENT_STATUSES = ["PENDING", "REQUIRES_ACTION", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "CANCELLED"] as const;

export type UserStatusCode = (typeof USER_STATUSES)[number];
export type RoleDecisionCode =
  | "FORBIDDEN"
  | "SELF"
  | "UNKNOWN_ROLE"
  | "NOT_HELD"
  | "ALREADY"
  | "MISSING"
  | "LAST_SUPER_ADMIN";

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isSuperAdmin(roleCodes: string[]): boolean {
  return roleCodes.includes(SUPER_ADMIN_ROLE_CODE);
}

export function isPortalAdministrator(roleCodes: string[]): boolean {
  return roleCodes.includes(ADMIN_ROLE_CODE) || roleCodes.includes(SUPER_ADMIN_ROLE_CODE);
}

export function parseDirectoryRole(value: string | undefined): (typeof DIRECTORY_ROLE_CODES)[number] | null {
  if (!value || value === "ALL") return null;
  return DIRECTORY_ROLE_CODES.find((code) => code === value) ?? null;
}

export function parseUserStatus(value: string | undefined): UserStatusCode | null {
  if (!value || value === "ALL") return null;
  return USER_STATUSES.find((code) => code === value) ?? null;
}

export function parseAppointmentStatus(value: string | undefined): (typeof APPOINTMENT_STATUSES)[number] | "CANCELLED" | null {
  if (!value || value === "ALL") return null;
  if (value === "CANCELLED") return "CANCELLED";
  return APPOINTMENT_STATUSES.find((code) => code === value) ?? null;
}

export function parsePaymentStatus(value: string | undefined): (typeof PAYMENT_STATUSES)[number] | "FAILED_OR_REFUNDED" | null {
  if (!value || value === "ALL") return null;
  if (value === "FAILED_OR_REFUNDED") return "FAILED_OR_REFUNDED";
  return PAYMENT_STATUSES.find((code) => code === value) ?? null;
}

export function parseConsultationMode(value: string | undefined): "ONLINE" | "IN_PERSON" | null {
  if (value === "ONLINE" || value === "IN_PERSON") return value;
  return null;
}

/** Africa/Freetown is GMT all year, so the calendar day is the UTC day. */
export function freetownDayBounds(now: Date): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PLATFORM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const start = parseFreetownDate(parts);
  if (!start) {
    const fallback = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { start: fallback, end: new Date(fallback.getTime() + 86_400_000) };
  }
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export function parseFreetownDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function parseReportRange(
  fromRaw: string,
  toRaw: string,
  now: Date,
): { from: Date; toExclusive: Date } | { error: string } {
  const today = freetownDayBounds(now).start;
  const from = fromRaw ? parseFreetownDate(fromRaw) : new Date(today.getTime() - 29 * 86_400_000);
  const to = toRaw ? parseFreetownDate(toRaw) : today;
  if (!from || !to) return { error: "Enter a valid date range." };
  if (from.getTime() > to.getTime()) return { error: "The start date must be on or before the end date." };
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (days > REPORT_MAX_DAYS) return { error: "Choose a range of 366 days or fewer." };
  return { from, toExclusive: new Date(to.getTime() + 86_400_000) };
}

export function cleanOperationalReason(value: string): string | null {
  const reason = value.replace(/\s+/g, " ").trim();
  if (reason.length < 10 || reason.length > 500) return null;
  return reason;
}

export function parseHoldMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const minutes = Number(trimmed);
  if (!Number.isInteger(minutes) || minutes < HOLD_MINUTES_MIN || minutes > HOLD_MINUTES_MAX) return null;
  return minutes;
}

type RoleChangeInput = {
  actorId: string;
  actorRoles: string[];
  targetId: string;
  targetRoles: string[];
  roleCode: string;
  change: "grant" | "revoke";
  activeSuperAdminCount: number;
  targetIsActiveSuperAdmin: boolean;
};

export function roleChangeDecision(input: RoleChangeInput): { ok: true } | { ok: false; code: RoleDecisionCode } {
  if (!isSuperAdmin(input.actorRoles)) return { ok: false, code: "FORBIDDEN" };
  if (input.roleCode !== ADMIN_ROLE_CODE && input.roleCode !== SUPER_ADMIN_ROLE_CODE) {
    return { ok: false, code: "UNKNOWN_ROLE" };
  }
  if (input.actorId === input.targetId) return { ok: false, code: "SELF" };
  const hasRole = input.targetRoles.includes(input.roleCode);
  if (input.change === "grant" && hasRole) return { ok: false, code: "ALREADY" };
  if (input.change === "revoke" && !hasRole) return { ok: false, code: "MISSING" };
  if (
    input.change === "revoke" &&
    input.roleCode === SUPER_ADMIN_ROLE_CODE &&
    input.targetIsActiveSuperAdmin &&
    input.activeSuperAdminCount <= 1
  ) {
    return { ok: false, code: "LAST_SUPER_ADMIN" };
  }
  return { ok: true };
}

type StatusChangeInput = {
  actorId: string;
  actorRoles: string[];
  targetId: string;
  targetStatus: UserStatusCode;
  targetDeleted: boolean;
  targetRoles: string[];
  change: "suspend" | "reactivate";
  activeSuperAdminCount: number;
};

export function accountStatusDecision(
  input: StatusChangeInput,
): { ok: true; next: "ACTIVE" | "SUSPENDED" } | { ok: false; code: "FORBIDDEN" | "SELF" | "DELETED" | "LAST_SUPER_ADMIN" | "UNSUPPORTED" } {
  if (!isPortalAdministrator(input.actorRoles)) return { ok: false, code: "FORBIDDEN" };
  if (input.targetDeleted) return { ok: false, code: "DELETED" };
  if (input.actorId === input.targetId) return { ok: false, code: "SELF" };
  const elevated = input.targetRoles.some((code) => code === ADMIN_ROLE_CODE || code === SUPER_ADMIN_ROLE_CODE);
  if (elevated && !isSuperAdmin(input.actorRoles)) return { ok: false, code: "FORBIDDEN" };
  if (
    input.change === "suspend" &&
    input.targetRoles.includes(SUPER_ADMIN_ROLE_CODE) &&
    input.targetStatus === "ACTIVE" &&
    input.activeSuperAdminCount <= 1
  ) {
    return { ok: false, code: "LAST_SUPER_ADMIN" };
  }
  if (input.change === "suspend") {
    if (input.targetStatus !== "ACTIVE") return { ok: false, code: "UNSUPPORTED" };
    return { ok: true, next: "SUSPENDED" };
  }
  if (input.targetStatus !== "SUSPENDED") return { ok: false, code: "UNSUPPORTED" };
  return { ok: true, next: "ACTIVE" };
}

const CANCELLABLE = new Set<string>(OCCUPYING_APPOINTMENT_STATUSES);

export function adminCancelDecision(status: string): boolean {
  return CANCELLABLE.has(status);
}

export type ReconciliationFlag =
  | "late_payment_after_released_hold"
  | "paid_without_confirmed_appointment"
  | "event_status_differs"
  | "unresolved_payment_status"
  | "no_provider_reference"
  | "pending_after_expired_booking";

export function reconciliationFlags(input: {
  paymentStatus: string;
  appointmentStatus: string;
  providerReference: string | null;
  latestEventStatus: string | null;
}): ReconciliationFlag[] {
  const flags: ReconciliationFlag[] = [];
  if (input.paymentStatus === "PAID" && input.appointmentStatus === "EXPIRED_UNPAID") {
    flags.push("late_payment_after_released_hold");
  } else if (input.paymentStatus === "PAID" && !CONFIRMED_VISIT_STATUSES.includes(input.appointmentStatus as (typeof CONFIRMED_VISIT_STATUSES)[number])) {
    flags.push("paid_without_confirmed_appointment");
  }
  if (input.latestEventStatus && input.latestEventStatus !== input.paymentStatus) {
    flags.push("event_status_differs");
  }
  if (input.paymentStatus === "FAILED" || input.paymentStatus === "REQUIRES_ACTION") {
    flags.push("unresolved_payment_status");
  }
  if (input.paymentStatus === "PENDING" && !input.providerReference) {
    flags.push("no_provider_reference");
  }
  if (input.paymentStatus === "PENDING" && input.appointmentStatus === "EXPIRED_UNPAID") {
    flags.push("pending_after_expired_booking");
  }
  return flags;
}

export function sanitizeMetadata(value: unknown): Record<string, string | number | boolean | null> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, entry] of Object.entries(value).slice(0, 20)) {
    if (BLOCKED_METADATA.test(key)) continue;
    if (entry === null || typeof entry === "number" || typeof entry === "boolean") {
      safe[key] = entry;
      continue;
    }
    if (typeof entry === "string") {
      safe[key] = entry.slice(0, 200);
    }
  }
  return Object.keys(safe).length > 0 ? safe : null;
}
