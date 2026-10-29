"use server";

import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { loadPatientGuideFacts } from "@/lib/guide/patient-facts";

export async function loadPatientGuideFactsAction() {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  return loadPatientGuideFacts(prisma, user.id);
}
