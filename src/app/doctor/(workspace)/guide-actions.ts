"use server";

import { requireClinicalPortal } from "@/lib/doctor/session";
import { prisma } from "@/lib/db/prisma";
import { loadDoctorGuideFacts } from "@/lib/guide/doctor-facts";

export async function loadDoctorGuideFactsAction() {
  const portal = await requireClinicalPortal();
  return loadDoctorGuideFacts(prisma, portal.doctor, portal.access === "ready");
}
