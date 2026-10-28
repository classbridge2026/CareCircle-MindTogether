import type { PrismaClient } from "@prisma/client";
import type { AdminIconName } from "@/components/admin/admin-icons";
import { loadCatalogSummary } from "@/lib/catalog/queries";
import { isSchemaMismatch } from "@/lib/doctors/errors";
import { adminEntityHref, formatPlatformDay } from "./labels";
import { PLATFORM_TIMEZONE, freetownDayBounds } from "./rules";

const CONFIRMED = new Set(["CONFIRMED", "CHECKED_IN", "IN_PROGRESS"]);
const CANCELLED = new Set(["CANCELLED_BY_PATIENT", "CANCELLED_BY_DOCTOR", "CANCELLED_BY_ADMIN"]);

const STATUS_SLICES = [
  { key: "confirmed", label: "Confirmed", color: "#0f766e", match: (status: string) => CONFIRMED.has(status) },
  { key: "pending", label: "Pending", color: "#d97706", match: (status: string) => status === "PENDING_PAYMENT" || status === "PENDING_APPROVAL" },
  { key: "completed", label: "Completed", color: "#2563eb", match: (status: string) => status === "COMPLETED" },
  { key: "cancelled", label: "Cancelled", color: "#e11d48", match: (status: string) => CANCELLED.has(status) },
  { key: "expired", label: "Expired unpaid", color: "#64748b", match: (status: string) => status === "EXPIRED_UNPAID" },
  { key: "no-show", label: "No show", color: "#7c3aed", match: (status: string) => status === "NO_SHOW" },
  { key: "rescheduled", label: "Rescheduled", color: "#0e7490", match: (status: string) => status === "RESCHEDULED" },
] as const;

const ACTIVITY_TITLES: Record<string, string> = {
  "appointment.booked": "Appointment booked",
  "appointment.follow_up_scheduled": "Follow-up scheduled",
  "appointment.status_updated": "Appointment updated",
  "appointment.rescheduled": "Appointment rescheduled",
  "admin.seeded": "Administrator account created",
  "admin.seed_updated": "Administrator account updated",
  "notification.retry": "Notification retried",
  "consent.granted": "Consent granted",
  "consent.withdrawn": "Consent withdrawn",
  "clinical.record.read": "Clinical record opened",
};

function failed(error: unknown) {
  if (isSchemaMismatch(error)) return { ok: false as const, code: "SCHEMA" as const };
  return { ok: false as const, code: "UNAVAILABLE" as const };
}

function dayKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PLATFORM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function weekStart(now: Date): Date {
  const today = freetownDayBounds(now).start;
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TIMEZONE, weekday: "short" }).format(now);
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  return new Date(today.getTime() - (index < 0 ? 0 : index) * 86_400_000);
}

function relativeWhen(value: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - value.getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatPlatformDay(value);
}

function activityTitle(action: string): string {
  return (
    ACTIVITY_TITLES[action] ??
    action
      .replace(/[._]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function activityIcon(action: string, entityType: string): AdminIconName {
  const key = `${action} ${entityType}`.toLowerCase();
  if (key.includes("verif") || key.includes("approved")) return "check";
  if (entityType === "DoctorProfile") return "doctor";
  if (entityType === "PatientProfile" || entityType === "User") return "users";
  if (entityType === "Appointment") return "calendar";
  if (entityType === "ConsultationService" || entityType === "DoctorOffering") return "settings";
  if (entityType === "Location") return "location";
  if (entityType === "Payment") return "payment";
  if (entityType === "Notification") return "bell";
  return "audit";
}

export async function loadHomeDashboard(db: PrismaClient, actorId: string, now = new Date()) {
  const day = freetownDayBounds(now);
  const trendStart = new Date(day.start.getTime() - 6 * 86_400_000);
  const week = weekStart(now);
  try {
    const [account, doctors, patients, patientsThisWeek, todayGroups, statusGroups, trendRows, specialtyGroups, approvals, activities, catalog] =
      await Promise.all([
        db.user.findUnique({
          where: { id: actorId },
          select: {
            email: true,
            patientProfile: { select: { fullName: true } },
            doctorProfile: { select: { fullName: true } },
          },
        }),
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
        db.appointment.groupBy({ by: ["status"], _count: { _all: true } }),
        db.appointment.findMany({
          where: { startsAt: { gte: trendStart, lt: day.end } },
          select: { startsAt: true },
        }),
        db.appointment.groupBy({
          by: ["specialtyId"],
          _count: { _all: true },
          orderBy: { _count: { specialtyId: "desc" } },
          take: 5,
        }),
        db.doctorProfile.findMany({
          where: { verificationStatus: { in: ["SUBMITTED", "UNDER_REVIEW"] }, user: { deletedAt: null } },
          orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
          take: 5,
          select: {
            id: true,
            fullName: true,
            qualificationTitle: true,
            submittedAt: true,
            createdAt: true,
            specialties: { select: { isPrimary: true, specialty: { select: { name: true } } } },
          },
        }),
        db.auditLog.findMany({
          orderBy: { occurredAt: "desc" },
          take: 5,
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            occurredAt: true,
            actor: { select: { email: true } },
          },
        }),
        loadCatalogSummary(db),
      ]);
    if (!catalog.ok) return catalog;

    const specialtyNames = specialtyGroups.length
      ? await db.specialty.findMany({
          where: { id: { in: specialtyGroups.map((row) => row.specialtyId) } },
          select: { id: true, name: true },
        })
      : [];
    const specialtyName = new Map(specialtyNames.map((row) => [row.id, row.name]));
    const doctorCount = (status: string) => doctors.find((row) => row.verificationStatus === status)?._count._all ?? 0;
    const approved = doctorCount("APPROVED");
    const pendingDoctors = doctorCount("SUBMITTED") + doctorCount("UNDER_REVIEW");
    const todayCount = (matches: (status: string) => boolean) =>
      todayGroups.reduce((sum, row) => sum + (matches(row.status) ? row._count._all : 0), 0);
    const countsByDay = new Map<string, number>();
    for (const row of trendRows) {
      const key = dayKey(row.startsAt);
      countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
    }
    const trend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(trendStart.getTime() + index * 86_400_000);
      return {
        label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: PLATFORM_TIMEZONE }).format(date),
        count: countsByDay.get(dayKey(date)) ?? 0,
      };
    });
    const statuses: Array<{ key: string; label: string; color: string; count: number }> = STATUS_SLICES.map((slice) => ({
      key: slice.key,
      label: slice.label,
      color: slice.color,
      count: statusGroups.reduce((sum, row) => sum + (slice.match(row.status) ? row._count._all : 0), 0),
    })).filter((slice) => slice.count > 0 || ["confirmed", "pending", "completed", "cancelled"].includes(slice.key));
    const other = statusGroups.reduce((sum, row) => sum + (STATUS_SLICES.some((slice) => slice.match(row.status)) ? 0 : row._count._all), 0);
    if (other > 0) statuses.push({ key: "other", label: "Other", color: "#94a3b8", count: other });

    return {
      ok: true as const,
      name: account?.doctorProfile?.fullName || account?.patientProfile?.fullName || account?.email || "Administrator",
      dateLabel: new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: PLATFORM_TIMEZONE,
      }).format(now),
      year: Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: PLATFORM_TIMEZONE }).format(now)),
      doctors: { total: doctors.reduce((sum, row) => sum + row._count._all, 0), approved, pending: pendingDoctors },
      patients: { total: patients, thisWeek: patientsThisWeek },
      today: {
        total: todayGroups.reduce((sum, row) => sum + row._count._all, 0),
        confirmed: todayCount((status) => CONFIRMED.has(status)),
        pending: todayCount((status) => status === "PENDING_PAYMENT" || status === "PENDING_APPROVAL"),
      },
      services: { active: catalog.counts.activeServices, inactive: catalog.counts.inactiveServices },
      locations: {
        total: catalog.counts.activeLocations + catalog.counts.inactiveLocations,
        inactive: catalog.counts.inactiveLocations,
      },
      trend,
      statuses,
      appointmentTotal: statusGroups.reduce((sum, row) => sum + row._count._all, 0),
      activities: activities.map((row) => ({
        id: row.id,
        title: activityTitle(row.action),
        detail: row.actor?.email ?? row.entityType.replace(/([a-z])([A-Z])/g, "$1 $2"),
        when: relativeWhen(row.occurredAt, now),
        href: adminEntityHref(row.entityType, row.entityId),
        icon: activityIcon(row.action, row.entityType),
      })),
      approvals: approvals.map((row) => {
        const specialty = row.specialties.find((item) => item.isPrimary) ?? row.specialties[0];
        const details = [specialty?.specialty.name, row.qualificationTitle].filter(Boolean).join(" · ");
        return {
          id: row.id,
          name: row.fullName,
          details: details || "Submitted profile",
          submitted: formatPlatformDay(row.submittedAt ?? row.createdAt),
        };
      }),
      specialties: specialtyGroups.map((row) => ({
        id: row.specialtyId,
        name: specialtyName.get(row.specialtyId) ?? "Specialty",
        count: row._count._all,
      })),
    };
  } catch (error) {
    return failed(error);
  }
}
