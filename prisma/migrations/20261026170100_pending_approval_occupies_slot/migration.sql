ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_doctor_occupying_no_overlap";

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_doctor_occupying_no_overlap"
  EXCLUDE USING gist (
    "doctorProfileId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE (
    "status" IN (
      'PENDING_PAYMENT',
      'PENDING_APPROVAL',
      'CONFIRMED',
      'CHECKED_IN',
      'IN_PROGRESS'
    )
  );
