import type { PrismaClient } from "@prisma/client";
import { loadDoctorDashboard } from "@/lib/doctor/workspace";
import type { DoctorGuideFacts } from "./role-guide";

const hidden: DoctorGuideFacts = { ready: false, today: 0, pendingToday: 0, activePatients: 0, pendingNotes: 0, followUps: 0 };

export async function loadDoctorGuideFacts(
  db: PrismaClient,
  doctor: { id: string; displayName: string } | null,
  ready: boolean,
): Promise<DoctorGuideFacts | null> {
  if (!ready || !doctor) return hidden;
  try {
    const board = await loadDoctorDashboard(db, doctor);
    if (!board.ok) return null;
    return {
      ready: true,
      today: board.counts.today,
      pendingToday: board.counts.pendingToday,
      activePatients: board.counts.activePatients,
      pendingNotes: board.counts.pendingNotes,
      followUps: board.counts.followUps,
    };
  } catch {
    return null;
  }
}
