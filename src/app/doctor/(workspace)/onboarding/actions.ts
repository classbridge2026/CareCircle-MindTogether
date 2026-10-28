"use server";

import { revalidatePath } from "next/cache";
import { DOCTOR_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { deleteDoctorCredential, uploadDoctorCredential } from "@/lib/doctors/credentials";
import { profileInputFromForm, saveDoctorProfile } from "@/lib/doctors/profile";
import { createPrivateStorage } from "@/lib/storage/private-storage";

export type ProfileActionState = {
  message?: string;
  tone?: "ok" | "error";
  fieldErrors?: Record<string, string>;
};

async function doctorUser() {
  return requireStoredRoles([DOCTOR_ROLE_CODE]);
}

export async function saveProfileAction(_previous: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const user = await doctorUser();
  const mode = String(formData.get("intent") ?? "") === "submit" ? "submit" : "draft";
  const result = await saveDoctorProfile(user.id, profileInputFromForm(formData), {
    db: prisma,
    mode,
    now: new Date(),
    logError: (code) => console.error(code),
  });
  revalidatePath("/doctor/onboarding");
  revalidatePath("/doctor/profile");
  revalidatePath("/doctor");
  revalidatePath("/admin/doctors/pending");
  revalidatePath("/admin/notifications");
  if (!result.ok) {
    return { message: result.formMessage, tone: "error", fieldErrors: result.fieldErrors };
  }
  return { message: result.message, tone: "ok" };
}

export async function uploadCredentialAction(_previous: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const user = await doctorUser();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { message: "Choose a document to upload.", tone: "error" };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadDoctorCredential(
    {
      actorUserId: user.id,
      type: String(formData.get("type") ?? ""),
      filename: file.name,
      declaredMime: file.type,
      bytes,
      expiresOn: String(formData.get("expiresOn") ?? ""),
    },
    {
      db: prisma,
      storage: createPrivateStorage(),
      now: new Date(),
      logError: (code) => console.error(code),
    },
  );
  revalidatePath("/doctor/onboarding");
  revalidatePath("/doctor/profile");
  revalidatePath("/admin/doctors/pending");
  revalidatePath("/admin/notifications");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function deleteCredentialAction(_previous: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const user = await doctorUser();
  const result = await deleteDoctorCredential(String(formData.get("credentialId") ?? ""), {
    db: prisma,
    storage: createPrivateStorage(),
    actorUserId: user.id,
    logError: (code) => console.error(code),
  });
  revalidatePath("/doctor/onboarding");
  revalidatePath("/doctor/profile");
  revalidatePath("/admin/doctors/pending");
  revalidatePath("/admin/notifications");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}
