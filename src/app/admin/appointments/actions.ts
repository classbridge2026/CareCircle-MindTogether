"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import type { AdminActionState } from "@/lib/admin/action-state";
import { cancelAppointmentAsAdmin } from "@/lib/admin/mutations";
import { prisma } from "@/lib/db/prisma";

export async function cancelAppointmentAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await cancelAppointmentAsAdmin(
    { appointmentId: String(formData.get("appointmentId") ?? ""), reason: String(formData.get("reason") ?? "") },
    { db: prisma, actor: { userId: user.id, roleCodes: user.roleCodes } },
  );
  revalidatePath("/admin/appointments");
  revalidatePath("/admin");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}
