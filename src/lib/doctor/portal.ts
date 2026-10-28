import type { PrismaClient } from "@prisma/client";
import { formatPlatformDay } from "@/lib/admin/labels";
import { formatBookingWhen } from "@/lib/appointments/time";
import { freetownDate } from "@/lib/auth/age";
import { parseUuid } from "@/lib/catalog/rules";
import { isSchemaMismatch } from "@/lib/doctors/errors";
import { genderLabel } from "@/lib/patient/portal";

const openStatuses = ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] as const;

export function isFollowUpConsultation(input: { code: string; name: string }): boolean {
  return input.code.toUpperCase().includes("FOLLOW") || input.name.toLowerCase().includes("follow");
}

export function platformDayStart(now: Date): Date {
  return new Date(`${freetownDate(now)}T00:00:00.000Z`);
}

export function assignedGuardianLabel(
  rows: Array<{ status: string; revokedAt: Date | null; relationshipType: string }>,
): string {
  if (rows.length === 0) return "Not recorded";
  return rows
    .map((row) => {
      const state = row.revokedAt || row.status === "REVOKED" ? "Revoked" : row.status === "AUTHORIZED" ? "Authorized" : row.status === "PENDING" ? "Pending" : "Not authorized";
      const kind = row.relationshipType === "LEGAL_GUARDIAN" ? "Legal guardian" : row.relationshipType === "PARENT" ? "Parent" : "Guardian";
      return `${kind} · ${state}`;
    })
    .join("; ");
}

function failed(error: unknown) {
  return { ok: false as const, code: isSchemaMismatch(error) ? ("SCHEMA" as const) : ("UNAVAILABLE" as const) };
}

const followUpService = {
  OR: [{ code: { contains: "FOLLOW", mode: "insensitive" as const } }, { name: { contains: "follow", mode: "insensitive" as const } }],
};

function presentVisit(row: {
  id: string;
  status: string;
  mode: "ONLINE" | "IN_PERSON";
  startsAt: Date;
  patient: { id: string; fullName: string; user: { id: string; profileImageUpdatedAt: Date | null } };
  consultationService: { name: string; code: string };
}) {
  return {
    id: row.id,
    status: row.status,
    mode: row.mode,
    when: formatBookingWhen(row.startsAt),
    patientId: row.patient.id,
    patientUserId: row.patient.user.id,
    patientImageVersion: row.patient.user.profileImageUpdatedAt?.toISOString() ?? null,
    patient: row.patient.fullName,
    service: row.consultationService.name,
    followUp: isFollowUpConsultation(row.consultationService),
  };
}

export async function loadDoctorBoard(db: PrismaClient, userId: string, now = new Date()) {
  try {
    const doctor = await db.doctorProfile.findUnique({ where: { userId }, select: { id: true, displayName: true } });
    if (!doctor) return { ok: true as const, displayName: null, today: [], upcoming: [], earlier: [], followUps: [] };
    const dayStart = platformDayStart(now);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const visitSelect = {
      id: true,
      status: true,
      mode: true,
      startsAt: true,
      patient: { select: { id: true, fullName: true, user: { select: { id: true, profileImageUpdatedAt: true } } } },
      consultationService: { select: { name: true, code: true } },
    } as const;
    const [today, upcoming, earlier, followUps] = await Promise.all([
      db.appointment.findMany({
        where: { doctorProfileId: doctor.id, startsAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { startsAt: "asc" },
        take: 20,
        select: visitSelect,
      }),
      db.appointment.findMany({
        where: { doctorProfileId: doctor.id, startsAt: { gte: dayEnd } },
        orderBy: { startsAt: "asc" },
        take: 30,
        select: visitSelect,
      }),
      db.appointment.findMany({
        where: { doctorProfileId: doctor.id, startsAt: { lt: dayStart } },
        orderBy: { startsAt: "desc" },
        take: 20,
        select: visitSelect,
      }),
      db.appointment.findMany({
        where: {
          doctorProfileId: doctor.id,
          startsAt: { gte: now },
          status: { in: [...openStatuses] },
          consultationService: followUpService,
        },
        orderBy: { startsAt: "asc" },
        take: 10,
        select: visitSelect,
      }),
    ]);
    return {
      ok: true as const,
      displayName: doctor.displayName,
      today: today.map(presentVisit),
      upcoming: upcoming.map(presentVisit),
      earlier: earlier.map(presentVisit),
      followUps: followUps.map(presentVisit),
    };
  } catch (error) {
    return failed(error);
  }
}

export async function listAssignedPatients(db: PrismaClient, userId: string) {
  try {
    const doctor = await db.doctorProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!doctor) return { ok: true as const, patients: [] };
    const rows = await db.patientProfile.findMany({
      where: { appointments: { some: { doctorProfileId: doctor.id } } },
      orderBy: { fullName: "asc" },
      take: 50,
      select: {
        id: true,
        fullName: true,
        user: { select: { id: true, profileImageUpdatedAt: true } },
        appointments: {
          where: { doctorProfileId: doctor.id },
          orderBy: { startsAt: "desc" },
          take: 1,
          select: { startsAt: true, status: true, consultationService: { select: { name: true } } },
        },
      },
    });
    return {
      ok: true as const,
      patients: rows.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        userId: row.user.id,
        imageVersion: row.user.profileImageUpdatedAt?.toISOString() ?? null,
        latestWhen: row.appointments[0] ? formatBookingWhen(row.appointments[0].startsAt) : null,
        latestStatus: row.appointments[0]?.status ?? null,
        latestService: row.appointments[0]?.consultationService.name ?? null,
      })),
    };
  } catch (error) {
    return failed(error);
  }
}

export async function loadAssignedPatient(db: PrismaClient, input: { patientId: string; actorUserId: string }) {
  if (!parseUuid(input.patientId)) return { ok: false as const, code: "NOT_FOUND" as const };
  try {
    const doctor = await db.doctorProfile.findUnique({ where: { userId: input.actorUserId }, select: { id: true } });
    if (!doctor) return { ok: false as const, code: "NOT_FOUND" as const };
    const patient = await db.patientProfile.findFirst({
      where: { id: input.patientId, appointments: { some: { doctorProfileId: doctor.id } } },
      select: {
        id: true,
        fullName: true,
        gender: true,
        dateOfBirth: true,
        preferredLanguage: true,
        isDependent: true,
        emergencyContactName: true,
        user: { select: { id: true, email: true, phoneE164: true, profileImageUpdatedAt: true } },
        guardianRelationships: { select: { status: true, revokedAt: true, relationshipType: true } },
        appointments: {
          where: { doctorProfileId: doctor.id },
          orderBy: { startsAt: "desc" },
          take: 20,
          select: {
            id: true,
            status: true,
            startsAt: true,
            consultationService: { select: { name: true, code: true } },
          },
        },
      },
    });
    if (!patient) return { ok: false as const, code: "NOT_FOUND" as const };
    await db.$transaction([
      db.recordAccessLog.create({
        data: {
          actorUserId: input.actorUserId,
          patientProfileId: patient.id,
          entityType: "PatientProfile",
          entityId: patient.id,
          action: "READ",
        },
      }),
      db.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "doctor.patient.viewed",
          entityType: "PatientProfile",
          entityId: patient.id,
          metadata: { appointments: patient.appointments.length },
        },
      }),
    ]);
    return {
      ok: true as const,
      patient: {
        id: patient.id,
        userId: patient.user.id,
        imageVersion: patient.user.profileImageUpdatedAt?.toISOString() ?? null,
        fullName: patient.fullName,
        gender: genderLabel(patient.gender),
        dateOfBirth: patient.dateOfBirth ? formatPlatformDay(patient.dateOfBirth) : null,
        preferredLanguage: patient.preferredLanguage,
        email: patient.user.email,
        phone: patient.user.phoneE164,
        emergencyContactName: patient.emergencyContactName,
        isDependent: patient.isDependent,
        guardian: assignedGuardianLabel(patient.guardianRelationships),
        visits: patient.appointments.map((visit) => ({
          id: visit.id,
          status: visit.status,
          when: formatBookingWhen(visit.startsAt),
          service: visit.consultationService.name,
          followUp: isFollowUpConsultation(visit.consultationService),
          record: visit.status === "IN_PROGRESS" || visit.status === "COMPLETED",
        })),
      },
    };
  } catch (error) {
    return failed(error);
  }
}
