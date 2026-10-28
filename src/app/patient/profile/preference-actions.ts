"use server";

import { revalidatePath } from "next/cache";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { saveReminderPreference } from "@/lib/notifications/delivery";
import { prisma } from "@/lib/db/prisma";

export type PreferenceState = { message?: string };

export async function saveReminderPreferenceAction(_previous: PreferenceState, formData: FormData): Promise<PreferenceState> {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const result = await saveReminderPreference(prisma, user.id, {
    emailReminders: formData.get("emailReminders") === "on",
  });
  revalidatePath("/patient/profile");
  return { message: result.message };
}
