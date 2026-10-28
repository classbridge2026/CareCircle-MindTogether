"use server";

import { revalidatePath } from "next/cache";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { clearOwnInAppNotifications, markAllOwnNotificationsRead, markOwnNotificationRead } from "@/lib/patient/portal";

export type NotificationActionState = { message?: string; tone?: "ok" | "error" };

export async function markReadAction(_previous: NotificationActionState, formData: FormData): Promise<NotificationActionState> {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const result = await markOwnNotificationRead(prisma, {
    userId: user.id,
    notificationId: String(formData.get("notificationId") ?? ""),
  });
  if (!result.ok) return { message: result.message, tone: "error" };
  revalidatePath("/patient/notifications");
  revalidatePath("/patient");
  return { message: result.message, tone: "ok" };
}

export async function markAllReadAction(previous: NotificationActionState, formData: FormData): Promise<NotificationActionState> {
  void previous;
  void formData;
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const result = await markAllOwnNotificationsRead(prisma, user.id);
  if (!result.ok) return { message: result.message, tone: "error" };
  revalidatePath("/patient/notifications");
  revalidatePath("/patient");
  return { message: result.message, tone: "ok" };
}

export async function clearNotificationsAction(previous: NotificationActionState, formData: FormData): Promise<NotificationActionState> {
  void previous;
  void formData;
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const result = await clearOwnInAppNotifications(prisma, user.id);
  if (!result.ok) return { message: result.message, tone: "error" };
  revalidatePath("/patient/notifications");
  revalidatePath("/patient", "layout");
  return { message: result.message, tone: "ok" };
}
