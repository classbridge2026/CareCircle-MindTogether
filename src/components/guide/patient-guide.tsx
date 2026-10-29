"use client";

import { loadPatientGuideFactsAction } from "@/app/patient/guide-actions";
import { chatWithPatient, patientOpening, patientPlace, PATIENT_STARTERS } from "@/lib/guide/role-guide";
import { GuidePanel } from "./role-guide";

export function PatientGuide() {
  return (
    <GuidePanel
      access="Your patient access"
      place={patientPlace}
      opening={patientOpening}
      starters={PATIENT_STARTERS}
      answer={chatWithPatient}
      loadFacts={loadPatientGuideFactsAction}
    />
  );
}
