-- Catalog fees, slugs, offering prices, location contact details, and appointment fee snapshots.
-- Does not rewrite earlier migrations. Apply separately; this file is not executed by the application.

-- ---------------------------------------------------------------------------
-- Specialties: unique slug and case-insensitive name
-- ---------------------------------------------------------------------------

ALTER TABLE "Specialty" ADD COLUMN "slug" TEXT;
ALTER TABLE "Specialty" ADD COLUMN "nameKey" TEXT;

UPDATE "Specialty"
SET
  "slug" = lower(replace("code", '_', '-')),
  "nameKey" = lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'));

ALTER TABLE "Specialty" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "Specialty" ALTER COLUMN "nameKey" SET NOT NULL;

CREATE UNIQUE INDEX "Specialty_slug_key" ON "Specialty"("slug");
CREATE UNIQUE INDEX "Specialty_nameKey_key" ON "Specialty"("nameKey");

ALTER TABLE "Specialty"
  ADD CONSTRAINT "Specialty_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- ---------------------------------------------------------------------------
-- Consultation services: mode, decimal default fee, preparation notes
-- ---------------------------------------------------------------------------

ALTER TABLE "ConsultationService" ADD COLUMN "slug" TEXT;
ALTER TABLE "ConsultationService" ADD COLUMN "nameKey" TEXT;
ALTER TABLE "ConsultationService" ADD COLUMN "mode" "ConsultationMode";
ALTER TABLE "ConsultationService" ADD COLUMN "defaultFee" DECIMAL(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE "ConsultationService" ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'SLL';
ALTER TABLE "ConsultationService" ADD COLUMN "preparationInstructions" TEXT;

UPDATE "ConsultationService"
SET
  "slug" = lower(replace("code", '_', '-')),
  "nameKey" = lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'));

INSERT INTO "ConsultationService" (
  "id", "code", "slug", "name", "nameKey", "description", "mode",
  "defaultDurationMinutes", "defaultFee", "currency", "preparationInstructions",
  "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  'ONLINE',
  'online-consultation',
  'Online consultation',
  'online consultation',
  'Consultation conducted online.',
  'ONLINE',
  30,
  0,
  'SLL',
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ConsultationService"
  WHERE "code" IN ('ONLINE', 'ONLINE_CONSULTATION')
     OR "slug" IN ('online', 'online-consultation')
     OR "nameKey" IN ('online consultation', 'online')
);

INSERT INTO "ConsultationService" (
  "id", "code", "slug", "name", "nameKey", "description", "mode",
  "defaultDurationMinutes", "defaultFee", "currency", "preparationInstructions",
  "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  'IN_PERSON',
  'in-person-consultation',
  'In-person consultation',
  'in-person consultation',
  'Consultation conducted at a CareCircle location.',
  'IN_PERSON',
  45,
  0,
  'SLL',
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ConsultationService"
  WHERE "code" IN ('IN_PERSON', 'INPERSON', 'IN_PERSON_CONSULTATION')
     OR "slug" IN ('in-person', 'in-person-consultation')
     OR "nameKey" IN ('in-person consultation', 'in person consultation', 'in-person')
);

ALTER TABLE "ConsultationService" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "ConsultationService" ALTER COLUMN "nameKey" SET NOT NULL;

CREATE UNIQUE INDEX "ConsultationService_slug_key" ON "ConsultationService"("slug");
CREATE UNIQUE INDEX "ConsultationService_nameKey_key" ON "ConsultationService"("nameKey");

ALTER TABLE "ConsultationService"
  ADD CONSTRAINT "ConsultationService_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT "ConsultationService_duration_positive" CHECK ("defaultDurationMinutes" > 0),
  ADD CONSTRAINT "ConsultationService_fee_nonnegative" CHECK ("defaultFee" >= 0),
  ADD CONSTRAINT "ConsultationService_currency_code" CHECK ("currency" ~ '^[A-Z]{3}$');

-- ---------------------------------------------------------------------------
-- Doctor offerings: decimal price and notes. Existing minor units are preserved.
-- ---------------------------------------------------------------------------

ALTER TABLE "DoctorOffering" ADD COLUMN "price" DECIMAL(14, 2);
ALTER TABLE "DoctorOffering" ADD COLUMN "notes" TEXT;

UPDATE "DoctorOffering"
SET "price" = ("priceAmountMinor"::numeric / 100)::decimal(14, 2);

ALTER TABLE "DoctorOffering" ALTER COLUMN "price" SET NOT NULL;

ALTER TABLE "DoctorOffering"
  ADD CONSTRAINT "DoctorOffering_price_nonnegative" CHECK ("price" >= 0),
  ADD CONSTRAINT "DoctorOffering_minor_nonnegative" CHECK ("priceAmountMinor" >= 0),
  ADD CONSTRAINT "DoctorOffering_duration_positive" CHECK ("durationMinutes" > 0),
  ADD CONSTRAINT "DoctorOffering_currency_code" CHECK ("currency" ~ '^[A-Z]{3}$');

-- ---------------------------------------------------------------------------
-- Appointment fee snapshot in major units. Existing minor-unit snapshots are copied.
-- Pricing administration must not update these columns.
-- ---------------------------------------------------------------------------

ALTER TABLE "Appointment" ADD COLUMN "feeAmount" DECIMAL(14, 2);

UPDATE "Appointment"
SET "feeAmount" = ("feeAmountMinor"::numeric / 100)::decimal(14, 2);

ALTER TABLE "Appointment" ALTER COLUMN "feeAmount" SET NOT NULL;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_fee_nonnegative" CHECK ("feeAmount" >= 0 AND "feeAmountMinor" >= 0),
  ADD CONSTRAINT "Appointment_currency_code" CHECK ("currency" ~ '^[A-Z]{3}$');

CREATE OR REPLACE FUNCTION "Appointment_reject_fee_snapshot_change"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."feeAmount" IS DISTINCT FROM OLD."feeAmount"
     OR NEW."feeAmountMinor" IS DISTINCT FROM OLD."feeAmountMinor"
     OR NEW."currency" IS DISTINCT FROM OLD."currency" THEN
    RAISE EXCEPTION 'appointment_fee_snapshot_immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Appointment_fee_snapshot_immutable"
  BEFORE UPDATE ON "Appointment"
  FOR EACH ROW
  EXECUTE PROCEDURE "Appointment_reject_fee_snapshot_change"();

-- ---------------------------------------------------------------------------
-- Platform locations: phone and optional coordinates. Country stays an ISO code.
-- ---------------------------------------------------------------------------

ALTER TABLE "Location" ADD COLUMN "phone" TEXT;
ALTER TABLE "Location" ADD COLUMN "latitude" DECIMAL(8, 6);
ALTER TABLE "Location" ADD COLUMN "longitude" DECIMAL(9, 6);

ALTER TABLE "Location"
  ADD CONSTRAINT "Location_country_code" CHECK ("countryCode" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "Location_phone_e164" CHECK ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{7,14}$'),
  ADD CONSTRAINT "Location_coordinates_together" CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL)
  ),
  ADD CONSTRAINT "Location_latitude_range" CHECK (
    "latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)
  ),
  ADD CONSTRAINT "Location_longitude_range" CHECK (
    "longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180)
  );

CREATE UNIQUE INDEX "Location_place_key"
  ON "Location" (lower("name"), lower("locality"), "countryCode");

INSERT INTO "PlatformSetting" ("id", "key", "valueJson", "updatedAt", "createdAt")
SELECT gen_random_uuid(), 'DEFAULT_CURRENCY', '"SLL"'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "PlatformSetting" WHERE "key" = 'DEFAULT_CURRENCY'
);
