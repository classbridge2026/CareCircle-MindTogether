import type { PrismaClient } from "@prisma/client";
import type { PortalFacts } from "@/lib/admin/portal-guide";
import { PLATFORM_TIMEZONE, freetownDayBounds } from "@/lib/admin/rules";

function weekStart(now: Date) {
  const today = freetownDayBounds(now).start;
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TIMEZONE, weekday: "short" }).format(now);
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  return new Date(today.getTime() - (index < 0 ? 0 : index) * 86_400_000);
}

export async function loadGuideFacts(db: PrismaClient, now = new Date()): Promise<PortalFacts | null> {
  const day = freetownDayBounds(now);
  const week = weekStart(now);
  try {
    const [doctors, patients, patientsThisWeek, todayGroups, activeServices, locations] = await Promise.all([
      db.doctorProfile.groupBy({
        by: ["verificationStatus"],
        where: { user: { deletedAt: null } },
        _count: { _all: true },
      }),
      db.patientProfile.count({ where: { archivedAt: null } }),
      db.patientProfile.count({ where: { archivedAt: null, createdAt: { gte: week } } }),
      db.appointment.groupBy({
        by: ["status"],
        where: { startsAt: { gte: day.start, lt: day.end } },
        _count: { _all: true },
      }),
      db.consultationService.count({ where: { isActive: true } }),
      db.location.count(),
    ]);
    const count = (status: string) => doctors.find((row) => row.verificationStatus === status)?._count._all ?? 0;
    const today = (matches: (status: string) => boolean) => todayGroups.reduce((sum, row) => sum + (matches(row.status) ? row._count._all : 0), 0);
    return {
      doctors: doctors.reduce((sum, row) => sum + row._count._all, 0),
      approvedDoctors: count("APPROVED"),
      pendingDoctors: count("SUBMITTED") + count("UNDER_REVIEW"),
      patients,
      patientsThisWeek,
      todayAppointments: todayGroups.reduce((sum, row) => sum + row._count._all, 0),
      todayConfirmed: today((status) => status === "CONFIRMED" || status === "CHECKED_IN" || status === "IN_PROGRESS"),
      todayPending: today((status) => status === "PENDING_PAYMENT" || status === "PENDING_APPROVAL"),
      activeServices,
      locations,
    };
  } catch {
    return null;
  }
}
