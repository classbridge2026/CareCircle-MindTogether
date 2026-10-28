"use server";

import { revalidatePath } from "next/cache";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { grantOwnConsent, withdrawOwnConsent } from "@/lib/clinical/consent";
import { prisma } from "@/lib/db/prisma";

export type ConsentActionState = { message?: string; tone?: "ok" | "error" };

export async function withdrawConsentAction(_previous: ConsentActionState, formData: FormData): Promise<ConsentActionState> {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const result = await withdrawOwnConsent(prisma, { userId: user.id, consentType: String(formData.get("consentType") ?? "") });
  revalidatePath("/patient/profile");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function grantConsentAction(_previous: ConsentActionState, formData: FormData): Promise<ConsentActionState> {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  if (String(formData.get("confirm")) !== "yes") {
    return { message: "Confirm that you accept the current consent version.", tone: "error" };
  }
  const result = await grantOwnConsent(prisma, { userId: user.id, consentType: String(formData.get("consentType") ?? "") });
  revalidatePath("/patient/profile");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}
