import { isAdministrator } from "@/lib/doctors/rules";
import { DEFAULT_COUNTRY_CODE } from "./constants";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function canManageCatalog(roleCodes: string[]): boolean {
  return isAdministrator(roleCodes);
}

export function parseUuid(value: string): string | null {
  const id = value.trim();
  return UUID_PATTERN.test(id) ? id : null;
}

export function parseDuration(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,3}$/.test(trimmed)) {
    return null;
  }
  const minutes = Number(trimmed);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 480) {
    return null;
  }
  return minutes;
}

export function parseOptionalMode(
  value: string,
): { ok: true; mode: "ONLINE" | "IN_PERSON" | null } | { ok: false } {
  const raw = value.trim().toUpperCase();
  if (!raw || raw === "ANY") {
    return { ok: true, mode: null };
  }
  if (raw === "ONLINE" || raw === "IN_PERSON") {
    return { ok: true, mode: raw };
  }
  return { ok: false };
}

export function parseRequiredMode(value: string): "ONLINE" | "IN_PERSON" | null {
  const raw = value.trim().toUpperCase();
  if (raw === "ONLINE" || raw === "IN_PERSON") {
    return raw;
  }
  return null;
}

export function parseActivity(value: string | undefined): "ALL" | "ACTIVE" | "INACTIVE" {
  if (value === "ACTIVE" || value === "INACTIVE") {
    return value;
  }
  return "ALL";
}

export function parseCountryCode(value: string, other = ""): string | null {
  const selected = value.trim().toUpperCase();
  const code = selected === "OTHER" ? other.trim().toUpperCase() : selected || DEFAULT_COUNTRY_CODE;
  if (!/^[A-Z]{2}$/.test(code)) {
    return null;
  }
  return code;
}

export function cleanOptionalText(value: string, max: number): { ok: true; text: string | null } | { ok: false; message: string } {
  const text = value.trim();
  if (!text) {
    return { ok: true, text: null };
  }
  if (text.length > max) {
    return { ok: false, message: `Use ${max} characters or fewer.` };
  }
  return { ok: true, text };
}

export function cleanRequiredText(
  value: string,
  min: number,
  max: number,
  label: string,
): { ok: true; text: string } | { ok: false; message: string } {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max) {
    return { ok: false, message: `Enter ${label} between ${min} and ${max} characters.` };
  }
  return { ok: true, text };
}

export type OfferingEligibility = {
  verificationStatus: string | null;
  userStatus: string | null;
  deletedAt: Date | null;
  specialtyClaim: string | null;
  specialtyActive: boolean;
  serviceActive: boolean;
  serviceMode: "ONLINE" | "IN_PERSON" | null;
  offeringMode: "ONLINE" | "IN_PERSON";
};

export function activeOfferingBlocker(input: OfferingEligibility): string | null {
  if (!input.serviceActive) {
    return "Choose an active consultation service.";
  }
  if (input.serviceMode && input.serviceMode !== input.offeringMode) {
    return "That service is limited to a different consultation mode.";
  }
  if (input.deletedAt || input.userStatus !== "ACTIVE") {
    return "Only an active doctor account can have an active offering.";
  }
  if (input.verificationStatus !== "APPROVED") {
    return "Suspended, rejected, and unverified doctors cannot have an active offering.";
  }
  if (input.specialtyClaim !== "VERIFIED" || !input.specialtyActive) {
    return "The doctor needs a verified, active specialty for this offering.";
  }
  return null;
}

export type BookingCatalogInput = {
  serviceActive: boolean | null;
  locationRequested: boolean;
  locationActive: boolean | null;
  offeringRequested: boolean;
  offeringActive: boolean | null;
  offeringMatches: boolean;
};

export function bookingCatalogDecision(input: BookingCatalogInput): "ok" | "blocked" {
  if (input.serviceActive !== true) {
    return "blocked";
  }
  if (input.locationRequested && input.locationActive !== true) {
    return "blocked";
  }
  if (input.offeringRequested && (input.offeringActive !== true || !input.offeringMatches)) {
    return "blocked";
  }
  return "ok";
}

export function referencedDeleteDecision(
  counts: { appointments: number; rules?: number; offerings?: number; doctors?: number },
  noun: string,
): { allowed: boolean; message: string } {
  const total = counts.appointments + (counts.rules ?? 0) + (counts.offerings ?? 0) + (counts.doctors ?? 0);
  if (total > 0) {
    return {
      allowed: false,
      message: `This ${noun} is already used by existing records. Deactivate it so those records stay unchanged.`,
    };
  }
  return { allowed: true, message: "" };
}
