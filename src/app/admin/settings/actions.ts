"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { updateDefaultCurrency } from "@/lib/catalog/configuration";
import type { AdminActionState } from "@/lib/admin/action-state";
import { updatePaymentHoldMinutes, updateSystemName } from "@/lib/admin/mutations";
import { prisma } from "@/lib/db/prisma";

export async function updateCurrencySettingAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await updateDefaultCurrency(String(formData.get("currency") ?? ""), {
    db: prisma,
    actor: { userId: user.id, roleCodes: user.roleCodes },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/configuration");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function updateSystemNameAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await updateSystemName(String(formData.get("systemName") ?? ""), {
    db: prisma,
    actor: { userId: user.id, roleCodes: user.roleCodes },
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/patient", "layout");
  revalidatePath("/doctor", "layout");
  revalidatePath("/login", "layout");
  revalidatePath("/register", "layout");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function updateHoldSettingAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await updatePaymentHoldMinutes(String(formData.get("minutes") ?? ""), {
    db: prisma,
    actor: { userId: user.id, roleCodes: user.roleCodes },
  });
  revalidatePath("/admin/settings");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}
