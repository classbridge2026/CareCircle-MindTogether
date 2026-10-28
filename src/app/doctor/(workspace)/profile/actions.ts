"use server";

import { revalidatePath } from "next/cache";
import { DOCTOR_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { saveOfferingPreference } from "@/lib/doctors/consultation-preference";

export type PreferenceActionState = { message?: string; tone?: "ok" | "error" };

export async function saveOfferingPreferenceAction(
  _previous: PreferenceActionState,
  formData: FormData,
): Promise<PreferenceActionState> {
  const user = await requireStoredRoles([DOCTOR_ROLE_CODE]);
  const result = await saveOfferingPreference(
    user.id,
    {
      specialtyId: String(formData.get("specialtyId") ?? ""),
      consultationServiceId: String(formData.get("consultationServiceId") ?? ""),
      preference: String(formData.get("preference") ?? ""),
    },
    { db: prisma },
  );
  revalidatePath("/doctor/profile");
  revalidatePath("/doctor");
  revalidatePath("/patient/find");
  revalidatePath("/");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}
