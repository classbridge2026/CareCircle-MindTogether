"use server";

import { revalidatePath } from "next/cache";
import type { AdminActionState } from "@/lib/admin/action-state";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { activateScreening, saveQuestionSet, saveSupportContact, updateGovernance } from "@/lib/screening/service";

export async function updateScreeningGovernanceAction(formData: FormData) {
  const user = await requireStoredRoles([SUPER_ADMIN_ROLE_CODE]);
  const toolId = String(formData.get("toolId") ?? "");
  await updateGovernance(prisma, {
    actorUserId: user.id,
    roleCodes: user.roleCodes,
    toolId,
    licenseStatus: String(formData.get("licenseStatus") ?? ""),
    approvalState: String(formData.get("approvalState") ?? ""),
  });
  revalidatePath(`/admin/screening/${toolId}`);
  revalidatePath("/admin/screening");
}

export async function activateScreeningAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await requireStoredRoles([SUPER_ADMIN_ROLE_CODE]);
  const toolId = String(formData.get("toolId") ?? "");
  const result = await activateScreening(prisma, { actorUserId: user.id, roleCodes: user.roleCodes, toolId });
  revalidatePath("/admin/screening");
  revalidatePath(`/admin/screening/${toolId}`);
  revalidatePath("/patient/screening");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function saveScreeningQuestionsAction(payload: {
  toolId: string;
  clear: boolean;
  questions: unknown;
  bands: unknown;
}): Promise<{ ok: true; version: string; mode: string } | { ok: false; message: string }> {
  const user = await requireStoredRoles([SUPER_ADMIN_ROLE_CODE]);
  const saved = await saveQuestionSet(prisma, {
    actorUserId: user.id,
    roleCodes: user.roleCodes,
    toolId: payload.toolId,
    clear: payload.clear,
    questions: payload.questions,
    bands: payload.bands,
  });
  if (!saved.ok) return { ok: false, message: saved.message };
  revalidatePath(`/admin/screening/${payload.toolId}`);
  revalidatePath("/admin/screening");
  return { ok: true, version: saved.version, mode: saved.mode };
}

export async function saveSupportContactAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await saveSupportContact(prisma, {
    actorUserId: user.id,
    roleCodes: user.roleCodes,
    region: String(formData.get("region") ?? ""),
    serviceName: String(formData.get("serviceName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });
  revalidatePath("/admin/screening");
  revalidatePath("/admin/settings");
  revalidatePath("/patient/screening");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}
