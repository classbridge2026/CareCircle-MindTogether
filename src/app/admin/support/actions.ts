"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { reviewSupportRequest } from "@/lib/support/request";

export async function reviewSupportRequestAction(formData: FormData) {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const id = String(formData.get("id") ?? "");
  await reviewSupportRequest(prisma, id, user.id);
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${id}`);
}
