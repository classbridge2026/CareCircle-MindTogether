"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { createLocation, deleteLocation, updateLocation } from "@/lib/catalog/locations";
import { prisma } from "@/lib/db/prisma";

export type LocationActionState = { message?: string; tone?: "ok" | "error" };

async function actor() {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  return { userId: user.id, roleCodes: user.roleCodes };
}

function finish(result: { ok: boolean; message: string }): LocationActionState {
  revalidatePath("/admin/locations");
  revalidatePath("/admin");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

function locationFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    addressLine1: String(formData.get("addressLine1") ?? ""),
    addressLine2: String(formData.get("addressLine2") ?? ""),
    locality: String(formData.get("locality") ?? ""),
    district: String(formData.get("district") ?? ""),
    countryCode: String(formData.get("countryCode") ?? ""),
    countryCodeOther: String(formData.get("countryCodeOther") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    latitude: String(formData.get("latitude") ?? ""),
    longitude: String(formData.get("longitude") ?? ""),
    accessInstructions: String(formData.get("accessInstructions") ?? ""),
  };
}

export async function createLocationAction(_previous: LocationActionState, formData: FormData): Promise<LocationActionState> {
  const result = await createLocation(locationFields(formData), { db: prisma, actor: await actor() });
  return finish(result);
}

export async function updateLocationAction(_previous: LocationActionState, formData: FormData): Promise<LocationActionState> {
  const result = await updateLocation(
    { id: String(formData.get("id") ?? ""), ...locationFields(formData), isActive: formData.get("isActive") === "on" },
    { db: prisma, actor: await actor() },
  );
  return finish(result);
}

export async function deleteLocationAction(_previous: LocationActionState, formData: FormData): Promise<LocationActionState> {
  const result = await deleteLocation(String(formData.get("id") ?? ""), { db: prisma, actor: await actor() });
  return finish(result);
}
