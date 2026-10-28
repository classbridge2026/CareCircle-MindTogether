"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { createDoctorOffering, deleteDoctorOffering, updateDoctorOffering } from "@/lib/catalog/offerings";
import { prisma } from "@/lib/db/prisma";

export type OfferingActionState = { message?: string; tone?: "ok" | "error" };

async function actor() {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  return { userId: user.id, roleCodes: user.roleCodes };
}

function finish(result: { ok: boolean; message: string }): OfferingActionState {
  revalidatePath("/admin/offerings");
  revalidatePath("/admin/pricing");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/patient/find");
  revalidatePath("/doctor");
  revalidatePath("/doctor/profile");
  revalidatePath("/doctor/notifications");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function createOfferingAction(_previous: OfferingActionState, formData: FormData): Promise<OfferingActionState> {
  const result = await createDoctorOffering(
    {
      doctorProfileId: String(formData.get("doctorProfileId") ?? ""),
      specialtyId: String(formData.get("specialtyId") ?? ""),
      consultationServiceId: String(formData.get("consultationServiceId") ?? ""),
      mode: String(formData.get("mode") ?? ""),
      durationMinutes: String(formData.get("durationMinutes") ?? ""),
      fee: String(formData.get("fee") ?? ""),
      currency: String(formData.get("currency") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      isActive: formData.get("isActive") === "on",
    },
    { db: prisma, actor: await actor() },
  );
  return finish(result);
}

export async function updateOfferingAction(_previous: OfferingActionState, formData: FormData): Promise<OfferingActionState> {
  const result = await updateDoctorOffering(
    {
      id: String(formData.get("id") ?? ""),
      mode: String(formData.get("mode") ?? ""),
      durationMinutes: String(formData.get("durationMinutes") ?? ""),
      fee: String(formData.get("fee") ?? ""),
      currency: String(formData.get("currency") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      isActive: formData.get("isActive") === "on",
    },
    { db: prisma, actor: await actor() },
  );
  return finish(result);
}

export async function deleteOfferingAction(_previous: OfferingActionState, formData: FormData): Promise<OfferingActionState> {
  const result = await deleteDoctorOffering(String(formData.get("id") ?? ""), { db: prisma, actor: await actor() });
  return finish(result);
}
