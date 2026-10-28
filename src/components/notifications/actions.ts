"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { readSessionUser } from "@/lib/auth/current-user";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { isRecordsOffline } from "@/lib/db/offline";
import { prisma } from "@/lib/db/prisma";
import { markAllInAppNotificationsRead, markViewedNotificationsRead } from "@/lib/notifications/delivery";

/** Records that the signed-in person has seen these notices. A down database is skipped. */
export async function markViewedNotificationsAction(ids: string[]): Promise<{ ok: boolean }> {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false };
  try {
    const cookieStore = await cookies();
    const user = await readSessionUser(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
    if (!user || user.status !== "ACTIVE") return { ok: false };
    const result = await markViewedNotificationsRead(prisma, user.id, ids.slice(0, 50));
    if (!result.ok || result.updated === 0) return { ok: false };
    revalidatePath("/patient", "layout");
    revalidatePath("/doctor", "layout");
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    if (isRecordsOffline(error)) return { ok: false };
    throw error;
  }
}

/** Clears the signed-in person's unread in-app count. A down database is skipped. */
export async function markAllNotificationsReadAction(): Promise<{ ok: boolean }> {
  try {
    const cookieStore = await cookies();
    const user = await readSessionUser(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
    if (!user || user.status !== "ACTIVE") return { ok: false };
    const result = await markAllInAppNotificationsRead(prisma, user.id);
    if (!result.ok) return { ok: false };
    revalidatePath("/patient", "layout");
    revalidatePath("/doctor", "layout");
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    if (isRecordsOffline(error)) return { ok: false };
    throw error;
  }
}
