"use client";

import { loadDoctorGuideFactsAction } from "@/app/doctor/(workspace)/guide-actions";
import { chatWithDoctor, doctorOpening, doctorPlace, DOCTOR_STARTERS } from "@/lib/guide/role-guide";
import { GuidePanel } from "./role-guide";

export function DoctorGuide() {
  return (
    <GuidePanel
      access="Your clinician access"
      place={doctorPlace}
      opening={doctorOpening}
      starters={DOCTOR_STARTERS}
      answer={chatWithDoctor}
      loadFacts={loadDoctorGuideFactsAction}
    />
  );
}
