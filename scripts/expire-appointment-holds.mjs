/**
 * Idempotent expiry of overdue PENDING_PAYMENT holds.
 * Run periodically (Task Scheduler / cron). Does not print secrets.
 * Visit reminders are not sent from this script. Schedule
 * GET /api/jobs/appointment-clock with Authorization: Bearer $CRON_SECRET
 * at least once an hour. That job expires holds and sends the reminders.
 */
import { PrismaClient, AppointmentStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const expired = await prisma.$queryRaw`
    UPDATE "Appointment"
    SET
      "status" = 'EXPIRED_UNPAID',
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "status" = 'PENDING_PAYMENT'
      AND "paymentHoldExpiresAt" IS NOT NULL
      AND "paymentHoldExpiresAt" <= CURRENT_TIMESTAMP
    RETURNING "id"
  `;

  if (expired.length > 0) {
    await prisma.appointmentEvent.createMany({
      data: expired.map((row) => ({
        appointmentId: row.id,
        fromStatus: AppointmentStatus.PENDING_PAYMENT,
        toStatus: AppointmentStatus.EXPIRED_UNPAID,
        detail: "hold_expired",
      })),
    });
  }

  console.log(`expired_holds=${expired.length}`);
}

main()
  .catch((error) => {
    console.error("expire_holds_failed");
    console.error(error.name);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
