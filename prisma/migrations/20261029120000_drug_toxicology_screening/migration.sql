-- Add drug toxicology screening to the consultation catalog.
-- It stays unassigned until an administrator gives it to an approved doctor.

INSERT INTO "ConsultationService" (
  "id", "code", "slug", "name", "nameKey", "description", "mode",
  "defaultDurationMinutes", "defaultFee", "currency", "preparationInstructions",
  "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  'DRUG_TOXICOLOGY_SCREENING',
  'drug-toxicology-screening',
  'Drug toxicology screening',
  'drug toxicology screening',
  'A clinical visit to screen for drugs and other toxic substances. The result supports care. It is not a diagnosis by itself.',
  'IN_PERSON',
  30,
  0,
  'SLL',
  'Bring photo identification. A clinician explains the screening before it begins.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ConsultationService"
  WHERE "code" = 'DRUG_TOXICOLOGY_SCREENING'
     OR "slug" = 'drug-toxicology-screening'
     OR "nameKey" = 'drug toxicology screening'
);
