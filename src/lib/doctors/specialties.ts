import type { PrismaClient } from "@prisma/client";
import { catalogFailure, type CatalogResult } from "@/lib/catalog/errors";
import { resolveIdentity } from "@/lib/catalog/identity";
import { cleanOptionalText } from "@/lib/catalog/rules";
import { TEXT_LIMIT } from "@/lib/catalog/constants";
import { canManageSpecialties, specialtyDeleteDecision } from "./rules";

type Actor = { userId: string; roleCodes: string[] };

function denied(actor: Actor): CatalogResult | null {
  if (!canManageSpecialties(actor.roleCodes)) {
    return { ok: false, message: "Only an administrator can manage specialties." };
  }
  return null;
}

export async function createSpecialty(
  input: { code?: string; slug?: string; name: string; description: string },
  deps: { db: PrismaClient; actor: Actor },
): Promise<CatalogResult> {
  const block = denied(deps.actor);
  if (block) return block;
  const identity = resolveIdentity(input);
  if (!identity.ok) return identity;
  const description = cleanOptionalText(input.description, TEXT_LIMIT);
  if (!description.ok) return { ok: false, message: description.message };

  try {
    const duplicate = await deps.db.specialty.findFirst({
      where: { OR: [{ nameKey: identity.nameKey }, { slug: identity.slug }, { code: identity.code }] },
      select: { nameKey: true, slug: true, code: true },
    });
    if (duplicate?.nameKey === identity.nameKey) {
      return { ok: false, message: "A specialty with that name already exists." };
    }
    if (duplicate?.slug === identity.slug) {
      return { ok: false, message: "A specialty with that slug already exists." };
    }
    if (duplicate) {
      return { ok: false, message: "That specialty code is already in use." };
    }

    await deps.db.$transaction(async (tx) => {
      const created = await tx.specialty.create({
        data: {
          code: identity.code,
          slug: identity.slug,
          name: identity.name,
          nameKey: identity.nameKey,
          description: description.text,
          isActive: true,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: deps.actor.userId,
          action: "specialty.created",
          entityType: "Specialty",
          entityId: created.id,
          metadata: { code: identity.code, slug: identity.slug },
        },
      });
    });
  } catch (error) {
    return { ok: false, message: catalogFailure(error, "A specialty with that name or slug already exists.") };
  }
  return { ok: true, message: `${identity.name} was added.` };
}

export async function updateSpecialty(
  input: { id: string; name: string; description: string; sortOrder: string; isActive: boolean },
  deps: { db: PrismaClient; actor: Actor },
): Promise<CatalogResult> {
  const block = denied(deps.actor);
  if (block) return block;
  const identity = resolveIdentity({ name: input.name, slug: "placeholder" });
  if (!identity.ok) return { ok: false, message: identity.message };
  const description = cleanOptionalText(input.description, TEXT_LIMIT);
  if (!description.ok) return { ok: false, message: description.message };
  const sortOrder = Number(input.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) {
    return { ok: false, message: "Enter a sort order from 0 to 999." };
  }

  try {
    const existing = await deps.db.specialty.findUnique({ where: { id: input.id } });
    if (!existing) {
      return { ok: false, message: "That specialty was not found." };
    }
    const duplicate = await deps.db.specialty.findFirst({
      where: { nameKey: identity.nameKey, NOT: { id: existing.id } },
      select: { id: true },
    });
    if (duplicate) {
      return { ok: false, message: "A specialty with that name already exists." };
    }

    await deps.db.$transaction(async (tx) => {
      await tx.specialty.update({
        where: { id: existing.id },
        data: {
          name: identity.name,
          nameKey: identity.nameKey,
          description: description.text,
          sortOrder,
          isActive: input.isActive,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: deps.actor.userId,
          action: input.isActive ? "specialty.updated" : "specialty.deactivated",
          entityType: "Specialty",
          entityId: existing.id,
          metadata: { code: existing.code, slug: existing.slug, isActive: input.isActive },
        },
      });
    });
  } catch (error) {
    return { ok: false, message: catalogFailure(error, "A specialty with that name already exists.") };
  }

  return {
    ok: true,
    message: input.isActive
      ? `${identity.name} was updated. Existing doctor profiles and appointments were left unchanged.`
      : `${identity.name} was deactivated. Existing profiles and appointments still reference it, and it cannot be chosen for new claims.`,
  };
}

export async function deleteSpecialty(id: string, deps: { db: PrismaClient; actor: Actor }): Promise<CatalogResult> {
  const block = denied(deps.actor);
  if (block) return block;
  try {
    const existing = await deps.db.specialty.findUnique({ where: { id } });
    if (!existing) {
      return { ok: false, message: "That specialty was not found." };
    }
    const [doctors, offerings, appointments] = await Promise.all([
      deps.db.doctorSpecialty.count({ where: { specialtyId: id } }),
      deps.db.doctorOffering.count({ where: { specialtyId: id } }),
      deps.db.appointment.count({ where: { specialtyId: id } }),
    ]);
    const decision = specialtyDeleteDecision({ doctors, offerings, appointments });
    if (!decision.allowed) {
      return { ok: false, message: decision.message };
    }
    await deps.db.$transaction(async (tx) => {
      await tx.specialty.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorUserId: deps.actor.userId,
          action: "specialty.deleted",
          entityType: "Specialty",
          entityId: id,
          metadata: { code: existing.code, slug: existing.slug },
        },
      });
    });
  } catch (error) {
    return { ok: false, message: catalogFailure(error, "This specialty is already used. Deactivate it instead of deleting it.") };
  }
  return { ok: true, message: "The specialty was deleted." };
}
