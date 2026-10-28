-- The first specialty is shown to patients as Mental Health. The stable code stays PSYCHIATRY.
UPDATE "Specialty"
SET
  "name" = 'Mental Health',
  "nameKey" = 'mental health',
  "slug" = CASE WHEN "slug" = 'psychiatry' THEN 'mental-health' ELSE "slug" END,
  "description" = 'Mental health assessment and follow-up. Additional specialties can be added without a schema change.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'PSYCHIATRY';
