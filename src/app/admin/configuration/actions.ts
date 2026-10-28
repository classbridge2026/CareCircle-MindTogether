"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { updateDefaultCurrency } from "@/lib/catalog/configuration";
import { prisma } from "@/lib/db/prisma";

export type ConfigurationActionState = { message?: string; tone?: "ok" | "error" };

export async function updateCurrencyAction(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await updateDefaultCurrency(String(formData.get("currency") ?? ""), {
    db: prisma,
    actor: { userId: user.id, roleCodes: user.roleCodes },
  });
  revalidatePath("/admin/configuration");
  revalidatePath("/admin/services");
  revalidatePath("/admin/pricing");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}
