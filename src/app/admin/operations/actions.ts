"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import type { AdminActionState } from "@/lib/admin/action-state";
import { processExpiredHolds } from "@/lib/admin/mutations";
import { prisma } from "@/lib/db/prisma";

export async function processHoldsAction(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  void previous;
  void formData;
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await processExpiredHolds({ db: prisma, actor: { userId: user.id, roleCodes: user.roleCodes } });
  revalidatePath("/admin/operations");
  revalidatePath("/admin/appointments");
  revalidatePath("/admin");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}
