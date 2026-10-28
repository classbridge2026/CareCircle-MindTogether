"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import type { AdminActionState } from "@/lib/admin/action-state";
import { loadPatientDetail } from "@/lib/admin/directories";
import { formatPlatformDay, formatPlatformWhen, userStatusLabel, userStatusTone, type BadgeTone } from "@/lib/admin/labels";
import { archivePatientAccount, createPatientAccount, updatePatientAccount } from "@/lib/admin/patient-accounts";
import { prisma } from "@/lib/db/prisma";

export type PatientAccountView = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  statusLabel: string;
  statusTone: BadgeTone;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  residentialAddress: string;
  preferredLanguage: string;
  emergencyContactName: string;
  isDependent: boolean;
  createdLabel: string;
  appointments: number;
  imageVersion: string | null;
};

function state(result: { ok: boolean; message: string }): AdminActionState {
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

function refresh(patientId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/patients");
  revalidatePath("/admin/users");
  if (patientId) revalidatePath(`/admin/patients/${patientId}`);
}

export async function readPatientAccount(patientId: string): Promise<{ ok: true; patient: PatientAccountView } | { ok: false; message: string }> {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await loadPatientDetail(prisma, patientId);
  if (!result.ok) {
    return {
      ok: false,
      message: result.code === "NOT_FOUND" ? "This patient profile is no longer available." : "Patient details are unavailable right now.",
    };
  }
  const patient = result.patient;
  return {
    ok: true,
    patient: {
      id: patient.id,
      userId: patient.user.id,
      fullName: patient.fullName,
      email: patient.user.email,
      phone: patient.user.phoneE164,
      status: patient.user.status,
      statusLabel: userStatusLabel(patient.user.status),
      statusTone: userStatusTone(patient.user.status),
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth ? formatPlatformDay(patient.dateOfBirth) : "Not recorded",
      nationality: patient.nationality ?? "Not recorded",
      residentialAddress: patient.residentialAddress ?? "Not recorded",
      preferredLanguage: patient.preferredLanguage ?? "Not recorded",
      emergencyContactName: patient.emergencyContactName ?? "Not recorded",
      isDependent: patient.isDependent,
      createdLabel: formatPlatformWhen(patient.createdAt),
      appointments: patient._count.appointments,
      imageVersion: patient.user.profileImageUpdatedAt ? new Date(patient.user.profileImageUpdatedAt).toISOString() : null,
    },
  };
}

export async function createPatientAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const actor = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await createPatientAccount(
    {
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      password: String(formData.get("password") ?? ""),
      gender: String(formData.get("gender") ?? ""),
      dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
    },
    { db: prisma, actor: { userId: actor.id, roleCodes: actor.roleCodes } },
  );
  if (result.ok) refresh();
  return state(result);
}

export async function updatePatientAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const actor = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const patientId = String(formData.get("patientId") ?? "");
  const result = await updatePatientAccount(
    {
      userId: String(formData.get("userId") ?? ""),
      patientId,
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      timezone: String(formData.get("timezone") ?? "Africa/Freetown"),
      status: String(formData.get("status") ?? ""),
      password: String(formData.get("password") ?? ""),
      gender: String(formData.get("gender") ?? ""),
      dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
      nationality: String(formData.get("nationality") ?? ""),
      residentialAddress: String(formData.get("residentialAddress") ?? ""),
      preferredLanguage: String(formData.get("preferredLanguage") ?? ""),
      emergencyContactName: String(formData.get("emergencyContactName") ?? ""),
      isDependent: formData.get("isDependent") === "on",
    },
    { db: prisma, actor: { userId: actor.id, roleCodes: actor.roleCodes } },
  );
  if (result.ok) refresh(patientId);
  return state(result);
}

export async function deletePatientAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const actor = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const patientId = String(formData.get("patientId") ?? "");
  const result = await archivePatientAccount({ patientId }, { db: prisma, actor: { userId: actor.id, roleCodes: actor.roleCodes } });
  if (result.ok) refresh(patientId);
  return state(result);
}
