"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import type { AdminActionState } from "@/lib/admin/action-state";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/admin/mutations";
import { clearOwnInAppNotifications } from "@/lib/patient/portal";
import { retryOneNotice } from "@/lib/notifications/retry";
import { prisma } from "@/lib/db/prisma";

export async function markReadAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await markNotificationRead(String(formData.get("notificationId") ?? ""), {
    db: prisma,
    actor: { userId: user.id, roleCodes: user.roleCodes },
  });
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function markAllReadAction(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  void previous;
  void formData;
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await markAllNotificationsRead({ db: prisma, actor: { userId: user.id, roleCodes: user.roleCodes } });
  revalidatePath("/admin/notifications");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function clearNotificationsAction(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  void previous;
  void formData;
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await clearOwnInAppNotifications(prisma, user.id);
  revalidatePath("/admin/notifications");
  revalidatePath("/admin", "layout");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function retryDeliveryAction(formData: FormData): Promise<void> {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  await retryOneNotice(prisma, String(formData.get("notificationId") ?? ""), user.id);
  revalidatePath("/admin/notifications");
}
