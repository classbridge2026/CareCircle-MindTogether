import type { Prisma, PrismaClient } from "@prisma/client";
import { parseUuid } from "@/lib/catalog/rules";

export type ConsultationPreference = "ONLINE" | "IN_PERSON" | "BOTH";
export type OfferingMode = "ONLINE" | "IN_PERSON";

export function parseConsultationPreference(value: string): ConsultationPreference | null {
  const raw = value.trim().toUpperCase();
  if (raw === "ONLINE" || raw === "IN_PERSON" || raw === "BOTH") return raw;
  return null;
}

export function modesForPreference(preference: ConsultationPreference): OfferingMode[] {
  if (preference === "BOTH") return ["ONLINE", "IN_PERSON"];
  return [preference];
}

export function preferenceFromActiveModes(modes: OfferingMode[]): ConsultationPreference | null {
  const online = modes.includes("ONLINE");
  const inPerson = modes.includes("IN_PERSON");
  if (online && inPerson) return "BOTH";
  if (online) return "ONLINE";
  if (inPerson) return "IN_PERSON";
  return null;
}

export function preferenceFitsService(
  preference: ConsultationPreference,
  serviceMode: OfferingMode | null,
): boolean {
  if (!serviceMode) return true;
  return preference === serviceMode;
}

export type AssignedOffering = {
  id: string;
  mode: OfferingMode;
  isActive: boolean;
  durationMinutes: number;
  specialtyId: string;
  consultationServiceId: string;
  serviceName: string;
  specialtyName: string;
  serviceMode: OfferingMode | null;
};

export type OfferingPreferenceGroup = {
  specialtyId: string;
  consultationServiceId: string;
  serviceName: string;
  specialtyName: string;
  serviceMode: OfferingMode | null;
  durationMinutes: number;
  preference: ConsultationPreference | null;
  active: boolean;
};

export function groupAssignedOfferings(rows: AssignedOffering[]): OfferingPreferenceGroup[] {
  const groups = new Map<string, OfferingPreferenceGroup & { activeModes: OfferingMode[] }>();
  for (const row of rows) {
    const key = `${row.consultationServiceId}:${row.specialtyId}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        specialtyId: row.specialtyId,
        consultationServiceId: row.consultationServiceId,
        serviceName: row.serviceName,
        specialtyName: row.specialtyName,
        serviceMode: row.serviceMode,
        durationMinutes: row.durationMinutes,
        preference: null,
        active: row.isActive,
        activeModes: row.isActive ? [row.mode] : [],
      });
      continue;
    }
    if (row.isActive) {
      current.active = true;
      current.durationMinutes = row.durationMinutes;
      if (!current.activeModes.includes(row.mode)) current.activeModes.push(row.mode);
    }
  }
  return [...groups.values()]
    .map(({ activeModes, ...group }) => ({
      ...group,
      preference: preferenceFromActiveModes(activeModes),
    }))
    .sort((left, right) => left.serviceName.localeCompare(right.serviceName) || left.specialtyName.localeCompare(right.specialtyName));
}

type StoredOffering = {
  id: string;
  mode: OfferingMode;
  isActive: boolean;
  durationMinutes: number;
  price: Prisma.Decimal;
  priceAmountMinor: number;
  currency: string;
  notes: string | null;
};

export function planOfferingPreference(rows: StoredOffering[], desired: OfferingMode[]): {
  activateIds: string[];
  deactivateIds: string[];
  createModes: OfferingMode[];
} {
  const activateIds: string[] = [];
  const createModes: OfferingMode[] = [];
  for (const mode of desired) {
    const matches = rows.filter((row) => row.mode === mode);
    if (matches.some((row) => row.isActive)) continue;
    const inactive = matches.find((row) => !row.isActive);
    if (inactive) activateIds.push(inactive.id);
    else createModes.push(mode);
  }
  const deactivateIds = rows.filter((row) => row.isActive && !desired.includes(row.mode)).map((row) => row.id);
  return { activateIds, deactivateIds, createModes };
}

function serviceLimitMessage(serviceMode: OfferingMode): string {
  return serviceMode === "ONLINE"
    ? "That service can only be offered online."
    : "That service can only be offered in person.";
}

export async function saveOfferingPreference(
  actorUserId: string,
  input: { specialtyId: string; consultationServiceId: string; preference: string },
  deps: { db: PrismaClient },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const preference = parseConsultationPreference(input.preference);
  if (!preference) return { ok: false, message: "Choose online, in person, or both." };
  const specialtyId = parseUuid(input.specialtyId);
  const consultationServiceId = parseUuid(input.consultationServiceId);
  if (!specialtyId || !consultationServiceId) {
    return { ok: false, message: "That assigned service could not be found." };
  }

  const profile = await deps.db.doctorProfile.findUnique({
    where: { userId: actorUserId },
    select: {
      id: true,
      verificationStatus: true,
      user: { select: { status: true, deletedAt: true } },
    },
  });
  if (!profile || profile.verificationStatus !== "APPROVED" || profile.user.status !== "ACTIVE" || profile.user.deletedAt) {
    return { ok: false, message: "An approved doctor can set a consultation preference for an assigned service." };
  }

  const [service, claim, rows] = await Promise.all([
    deps.db.consultationService.findUnique({
      where: { id: consultationServiceId },
      select: { isActive: true, mode: true },
    }),
    deps.db.doctorSpecialty.findFirst({
      where: { doctorProfileId: profile.id, specialtyId },
      select: { claimStatus: true, specialty: { select: { isActive: true } } },
    }),
    deps.db.doctorOffering.findMany({
      where: { doctorProfileId: profile.id, specialtyId, consultationServiceId },
      select: {
        id: true,
        mode: true,
        isActive: true,
        durationMinutes: true,
        price: true,
        priceAmountMinor: true,
        currency: true,
        notes: true,
      },
    }),
  ]);
  if (!service?.isActive) return { ok: false, message: "That consultation service is not active." };
  if (!claim || claim.claimStatus !== "VERIFIED" || !claim.specialty.isActive) {
    return { ok: false, message: "This service is tied to a specialty that is not verified." };
  }
  if (rows.length === 0) return { ok: false, message: "That consultation service is not assigned to you." };
  if (service.mode && !preferenceFitsService(preference, service.mode)) {
    return { ok: false, message: serviceLimitMessage(service.mode) };
  }

  const desired = modesForPreference(preference);
  const plan = planOfferingPreference(rows, desired);
  const template = rows.find((row) => row.isActive) ?? rows[0];
  if (!template) return { ok: false, message: "That consultation service is not assigned to you." };

  try {
    await deps.db.$transaction(async (tx) => {
      for (const id of plan.activateIds) {
        await tx.doctorOffering.update({ where: { id }, data: { isActive: true } });
      }
      for (const id of plan.deactivateIds) {
        await tx.doctorOffering.update({ where: { id }, data: { isActive: false } });
      }
      for (const mode of plan.createModes) {
        const duplicate = await tx.doctorOffering.findFirst({
          where: { doctorProfileId: profile.id, specialtyId, consultationServiceId, mode, isActive: true },
          select: { id: true },
        });
        if (duplicate) continue;
        await tx.doctorOffering.create({
          data: {
            doctorProfileId: profile.id,
            specialtyId,
            consultationServiceId,
            mode,
            durationMinutes: template.durationMinutes,
            price: template.price,
            priceAmountMinor: template.priceAmountMinor,
            currency: template.currency,
            notes: template.notes,
            isActive: true,
          },
        });
      }
      const active = await tx.doctorOffering.findMany({
        where: { doctorProfileId: profile.id, isActive: true },
        select: { mode: true },
      });
      const consultationModes = [...new Set(active.map((row) => row.mode))];
      await tx.doctorProfile.update({
        where: { id: profile.id },
        data: { consultationModes },
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "offering.preference_updated",
          entityType: "DoctorOffering",
          entityId: template.id,
          metadata: { consultationServiceId, specialtyId, preference },
        },
      });
    });
  } catch {
    return { ok: false, message: "The consultation preference could not be saved." };
  }

  const label = preference === "BOTH" ? "online and in person" : preference === "ONLINE" ? "online" : "in person";
  return { ok: true, message: `Patients can book this service ${label}.` };
}
