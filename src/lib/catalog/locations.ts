import { Prisma, type PrismaClient } from "@prisma/client";
import { normalizePhone } from "@/lib/auth/phone";
import { TEXT_LIMIT } from "./constants";
import { catalogFailure, type CatalogResult } from "./errors";
import {
  canManageCatalog,
  cleanOptionalText,
  cleanRequiredText,
  parseCountryCode,
  parseUuid,
  referencedDeleteDecision,
} from "./rules";

type Actor = { userId: string; roleCodes: string[] };

const COORDINATE_PATTERN = /^-?\d{1,3}(?:\.\d{1,6})?$/;

function denied(actor: Actor): CatalogResult | null {
  if (!canManageCatalog(actor.roleCodes)) {
    return { ok: false, message: "Only an administrator can manage locations." };
  }
  return null;
}

function parseCoordinates(latitude: string, longitude: string): { ok: true; latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null } | { ok: false; message: string } {
  const latText = latitude.trim();
  const lngText = longitude.trim();
  if (!latText || !lngText || !COORDINATE_PATTERN.test(latText) || !COORDINATE_PATTERN.test(lngText)) {
    return { ok: false, message: "Verify the address on the map before saving this location." };
  }
  const lat = new Prisma.Decimal(latText);
  const lng = new Prisma.Decimal(lngText);
  if (lat.abs().gt(90) || lng.abs().gt(180)) {
    return { ok: false, message: "Latitude must be between -90 and 90, and longitude between -180 and 180." };
  }
  return { ok: true, latitude: lat, longitude: lng };
}

function parseLocation(input: {
  name: string;
  addressLine1: string;
  addressLine2: string;
  locality: string;
  district: string;
  countryCode: string;
  countryCodeOther: string;
  phone: string;
  latitude: string;
  longitude: string;
  accessInstructions: string;
}) {
  const name = cleanRequiredText(input.name, 2, 120, "a location name");
  if (!name.ok) return name;
  const addressLine1 = cleanRequiredText(input.addressLine1, 3, 200, "a verified place");
  if (!addressLine1.ok) return { ok: false as const, message: "Verify the address on the map before saving this location." };
  const addressLine2 = cleanOptionalText(input.addressLine2, 200);
  if (!addressLine2.ok) return addressLine2;
  const locality = cleanRequiredText(input.locality, 2, 80, "a city or town");
  if (!locality.ok) return locality;
  const district = cleanRequiredText(input.district, 2, 80, "a verified area");
  if (!district.ok) return { ok: false as const, message: "Verify the address on the map before saving this location." };
  const countryCode = parseCountryCode(input.countryCode, input.countryCodeOther);
  if (!countryCode) return { ok: false as const, message: "Enter a two-letter country code. Sierra Leone is SL." };
  const phoneText = input.phone.trim();
  let phone: string | null = null;
  if (phoneText) {
    phone = normalizePhone(phoneText);
    if (!phone) {
      return { ok: false as const, message: "Enter a valid phone number. Sierra Leone numbers can start with 0, and other countries need a country code." };
    }
  }
  const coordinates = parseCoordinates(input.latitude, input.longitude);
  if (!coordinates.ok) return coordinates;
  const accessInstructions = cleanOptionalText(input.accessInstructions, TEXT_LIMIT);
  if (!accessInstructions.ok) return accessInstructions;
  return {
    ok: true as const,
    data: {
      name: name.text,
      addressLine1: addressLine1.text,
      addressLine2: addressLine2.text,
      locality: locality.text,
      district: district.text,
      countryCode,
      phone,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      accessInstructions: accessInstructions.text,
    },
  };
}

export async function createLocation(
  input: {
    name: string;
    addressLine1: string;
    addressLine2: string;
    locality: string;
    district: string;
    countryCode: string;
    countryCodeOther: string;
    phone: string;
    latitude: string;
    longitude: string;
    accessInstructions: string;
  },
  deps: { db: PrismaClient; actor: Actor },
): Promise<CatalogResult> {
  const block = denied(deps.actor);
  if (block) return block;
  const parsed = parseLocation(input);
  if (!parsed.ok) return parsed;

  try {
    const duplicate = await deps.db.location.findFirst({
      where: {
        countryCode: parsed.data.countryCode,
        name: { equals: parsed.data.name, mode: "insensitive" },
        locality: { equals: parsed.data.locality, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return { ok: false, message: "A location with that name already exists in this city and country." };
    }
    await deps.db.$transaction(async (tx) => {
      const created = await tx.location.create({ data: { ...parsed.data, isActive: true } });
      await tx.auditLog.create({
        data: {
          actorUserId: deps.actor.userId,
          action: "location.created",
          entityType: "Location",
          entityId: created.id,
          metadata: { countryCode: parsed.data.countryCode, locality: parsed.data.locality },
        },
      });
    });
  } catch (error) {
    return { ok: false, message: catalogFailure(error, "A location with that name already exists in this city and country.") };
  }
  return { ok: true, message: `${parsed.data.name} was added and shown on the map.` };
}

export async function updateLocation(
  input: {
    id: string;
    name: string;
    addressLine1: string;
    addressLine2: string;
    locality: string;
    district: string;
    countryCode: string;
    countryCodeOther: string;
    phone: string;
    latitude: string;
    longitude: string;
    accessInstructions: string;
    isActive: boolean;
  },
  deps: { db: PrismaClient; actor: Actor },
): Promise<CatalogResult> {
  const block = denied(deps.actor);
  if (block) return block;
  const id = parseUuid(input.id);
  if (!id) return { ok: false, message: "That location was not found." };
  const parsed = parseLocation(input);
  if (!parsed.ok) return parsed;

  try {
    const existing = await deps.db.location.findUnique({ where: { id }, select: { id: true, isActive: true, deactivatedAt: true } });
    if (!existing) return { ok: false, message: "That location was not found." };
    const duplicate = await deps.db.location.findFirst({
      where: {
        countryCode: parsed.data.countryCode,
        name: { equals: parsed.data.name, mode: "insensitive" },
        locality: { equals: parsed.data.locality, mode: "insensitive" },
        NOT: { id },
      },
      select: { id: true },
    });
    if (duplicate) return { ok: false, message: "A location with that name already exists in this city and country." };
    const deactivatedAt = input.isActive ? null : existing.isActive ? new Date() : existing.deactivatedAt;
    await deps.db.$transaction(async (tx) => {
      await tx.location.update({
        where: { id },
        data: { ...parsed.data, isActive: input.isActive, deactivatedAt },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: deps.actor.userId,
          action: input.isActive ? "location.updated" : "location.deactivated",
          entityType: "Location",
          entityId: id,
          metadata: { countryCode: parsed.data.countryCode, isActive: input.isActive },
        },
      });
    });
  } catch (error) {
    return { ok: false, message: catalogFailure(error, "A location with that name already exists in this city and country.") };
  }
  return {
    ok: true,
    message: input.isActive
      ? `${parsed.data.name} was updated. Existing appointments still use this location.`
      : `${parsed.data.name} was deactivated. It stays on existing appointments and cannot be chosen for a new one.`,
  };
}

export async function deleteLocation(id: string, deps: { db: PrismaClient; actor: Actor }): Promise<CatalogResult> {
  const block = denied(deps.actor);
  if (block) return block;
  const locationId = parseUuid(id);
  if (!locationId) return { ok: false, message: "That location was not found." };
  try {
    const existing = await deps.db.location.findUnique({ where: { id: locationId }, select: { id: true, name: true } });
    if (!existing) return { ok: false, message: "That location was not found." };
    const [appointments, rules] = await Promise.all([
      deps.db.appointment.count({ where: { locationId } }),
      deps.db.doctorAvailabilityRule.count({ where: { locationId } }),
    ]);
    const decision = referencedDeleteDecision({ appointments, rules }, "location");
    if (!decision.allowed) return { ok: false, message: decision.message };
    await deps.db.$transaction(async (tx) => {
      await tx.location.delete({ where: { id: locationId } });
      await tx.auditLog.create({
        data: {
          actorUserId: deps.actor.userId,
          action: "location.deleted",
          entityType: "Location",
          entityId: locationId,
          metadata: { name: existing.name },
        },
      });
    });
  } catch (error) {
    return { ok: false, message: catalogFailure(error, "This location is already used. Deactivate it instead of deleting it.") };
  }
  return { ok: true, message: "The unused location was deleted." };
}
