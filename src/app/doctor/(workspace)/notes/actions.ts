"use server";

import { revalidatePath } from "next/cache";
import { DOCTOR_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { saveClinicalNote } from "@/lib/clinical/records";
import { blockIfUnapproved } from "@/lib/doctor/session";
import { prisma } from "@/lib/db/prisma";

export type PortalNoteState = { message?: string; tone?: "ok" | "error" };

export async function savePortalNoteAction(_previous: PortalNoteState, formData: FormData): Promise<PortalNoteState> {
  const user = await requireStoredRoles([DOCTOR_ROLE_CODE]);
  const blocked = await blockIfUnapproved(user.id);
  if (blocked) return { message: blocked, tone: "error" };
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const result = await saveClinicalNote(prisma, {
    appointmentId,
    actorUserId: user.id,
    kind: String(formData.get("kind") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  revalidatePath("/doctor/notes");
  revalidatePath(`/doctor/appointments/${appointmentId}/record`);
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}
