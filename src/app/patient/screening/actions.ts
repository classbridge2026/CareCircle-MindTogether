"use server";

import { redirect } from "next/navigation";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { startAssessment, submitAssessment } from "@/lib/screening/service";

export async function startScreeningAction(formData: FormData) {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const code = String(formData.get("code") ?? "");
  const result = await startAssessment(prisma, {
    actorUserId: user.id,
    code,
    consentAccepted: formData.get("consent") === "yes",
  });
  if (!result.ok) redirect(`/patient/screening/${code}?notice=${result.code}`);
  redirect(`/patient/screening/${code}/questions?assessment=${result.assessmentId}`);
}

export async function submitScreeningAction(formData: FormData) {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const code = String(formData.get("code") ?? "");
  const count = Number(formData.get("count") ?? 0);
  const answers: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const raw = String(formData.get(`answer-${index}`) ?? "");
    if (!/^\d{1,2}$/.test(raw)) redirect(`/patient/screening/${code}/questions?assessment=${assessmentId}&notice=INVALID`);
    answers.push(Number(raw));
  }
  const result = await submitAssessment(prisma, { actorUserId: user.id, assessmentId, answers });
  if (!result.ok) redirect(`/patient/screening/${code}/questions?assessment=${assessmentId}&notice=${result.code}`);
  redirect(`/patient/screening/results/${result.assessmentId}`);
}
