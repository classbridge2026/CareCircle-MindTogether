import type { PrismaClient } from "@prisma/client";
import type { PatientGuideFacts } from "./role-guide";

const OPEN = ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] as const;

export async function loadPatientGuideFacts(db: PrismaClient, userId: string, now = new Date()): Promise<PatientGuideFacts | null> {
  try {
    const profile = await db.patientProfile.findFirst({
      where: { userId, archivedAt: null },
      select: { id: true },
    });
    if (!profile) return { upcoming: 0, followUps: 0, pendingPayments: 0 };
    const [upcoming, followUps, pendingPayments] = await Promise.all([
      db.appointment.count({ where: { patientProfileId: profile.id, startsAt: { gte: now }, status: { in: [...OPEN] } } }),
      db.appointment.count({ where: { patientProfileId: profile.id, followUpOfId: { not: null }, startsAt: { gte: now }, status: { in: [...OPEN] } } }),
      db.payment.count({
        where: { payerUserId: userId, status: { in: ["PENDING", "REQUIRES_ACTION"] }, appointment: { patientProfileId: profile.id } },
      }),
    ]);
    return { upcoming, followUps, pendingPayments };
  } catch {
    return null;
  }
}
