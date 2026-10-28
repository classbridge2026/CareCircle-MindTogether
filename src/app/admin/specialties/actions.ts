"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { createSpecialty, deleteSpecialty, updateSpecialty } from "@/lib/doctors/specialties";

export type SpecialtyActionState = { message?: string; tone?: "ok" | "error" };

async function actor() {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  return { userId: user.id, roleCodes: user.roleCodes };
}

export async function createSpecialtyAction(
  _previous: SpecialtyActionState,
  formData: FormData,
): Promise<SpecialtyActionState> {
  const result = await createSpecialty(
    {
      code: String(formData.get("code") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
    },
    { db: prisma, actor: await actor() },
  );
  revalidatePath("/admin/specialties");
  revalidatePath("/admin/doctors/new");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function updateSpecialtyAction(
  _previous: SpecialtyActionState,
  formData: FormData,
): Promise<SpecialtyActionState> {
  const result = await updateSpecialty(
    {
      id: String(formData.get("id") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      sortOrder: String(formData.get("sortOrder") ?? "0"),
      isActive: formData.get("isActive") === "on",
    },
    { db: prisma, actor: await actor() },
  );
  revalidatePath("/admin/specialties");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function deleteSpecialtyAction(
  _previous: SpecialtyActionState,
  formData: FormData,
): Promise<SpecialtyActionState> {
  const result = await deleteSpecialty(String(formData.get("id") ?? ""), { db: prisma, actor: await actor() });
  revalidatePath("/admin/specialties");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}
