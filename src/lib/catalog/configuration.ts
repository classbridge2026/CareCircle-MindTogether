import type { PrismaClient } from "@prisma/client";
import { DEFAULT_CURRENCY_CODE, DEFAULT_CURRENCY_SETTING } from "./constants";
import { catalogFailure, type CatalogResult } from "./errors";
import { parseCurrency } from "./money";
import { canManageCatalog } from "./rules";

type Actor = { userId: string; roleCodes: string[] };

export async function readDefaultCurrency(db: PrismaClient): Promise<string> {
  const setting = await db.platformSetting.findUnique({ where: { key: DEFAULT_CURRENCY_SETTING } });
  const value = setting?.valueJson;
  if (typeof value === "string" && /^[A-Z]{3}$/.test(value)) {
    return value;
  }
  return DEFAULT_CURRENCY_CODE;
}

export async function updateDefaultCurrency(
  currencyInput: string,
  deps: { db: PrismaClient; actor: Actor },
): Promise<CatalogResult> {
  if (!canManageCatalog(deps.actor.roleCodes)) {
    return { ok: false, message: "Only an administrator can change platform configuration." };
  }
  const currency = parseCurrency(currencyInput, "");
  if (!currency) {
    return { ok: false, message: "Enter a three-letter currency code. SLL is the platform default." };
  }
  try {
    await deps.db.$transaction(async (tx) => {
      const saved = await tx.platformSetting.upsert({
        where: { key: DEFAULT_CURRENCY_SETTING },
        create: { key: DEFAULT_CURRENCY_SETTING, valueJson: currency },
        update: { valueJson: currency },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: deps.actor.userId,
          action: "configuration.currency_updated",
          entityType: "PlatformSetting",
          entityId: saved.id,
          metadata: { currency },
        },
      });
    });
  } catch (error) {
    return { ok: false, message: catalogFailure(error, "The default currency could not be saved.") };
  }
  return { ok: true, message: `The platform default currency is now ${currency}. Existing service and appointment fees were not changed.` };
}
