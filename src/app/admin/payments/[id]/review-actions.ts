"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import type { AdminActionState } from "@/lib/admin/action-state";
import { prisma } from "@/lib/db/prisma";
import { reviewOrangeTransfer } from "@/lib/payments/orange-transfer";

export async function reviewOrangeTransferAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const decision = formData.get("decision") === "reject" ? "reject" : "confirm";
  const paymentId = String(formData.get("paymentId") ?? "");
  const result = await reviewOrangeTransfer({ actorUserId: user.id, paymentId, decision }, prisma);
  revalidatePath(`/admin/payments/${paymentId}`);
  revalidatePath("/admin/payments");
  revalidatePath("/patient/payments");
  return { message: result.message, tone: result.tone === "ok" ? "ok" : "error" };
}
