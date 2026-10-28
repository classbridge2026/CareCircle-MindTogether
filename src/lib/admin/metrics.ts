import type { Prisma, PrismaClient } from "@prisma/client";
import { formatFee } from "@/lib/catalog/money";
import { loadCatalogSummary } from "@/lib/catalog/queries";
import { isSchemaMismatch } from "@/lib/doctors/errors";
import { loadDoctorOverview } from "@/lib/doctors/queries";
import { appointmentStatusLabel, formatMinorMoney, formatPlatformWhen, paymentStatusLabel } from "./labels";
import { CANCELLED_APPOINTMENT_STATUSES, FAILED_PAYMENT_STATUSES, UPCOMING_APPOINTMENT_STATUSES, freetownDayBounds } from "./rules";

function failed(error: unknown) {
  if (isSchemaMismatch(error)) return { ok: false as const, code: "SCHEMA" as const };
  return { ok: false as const, code: "UNAVAILABLE" as const };
}

const paymentSelect = {
  id: true,
  status: true,
  amountMinor: true,
  currency: true,
  providerCode: true,
  providerReference: true,
  createdAt: true,
  payer: { select: { email: true } },
  appointment: { select: { id: true, status: true, paymentHoldExpiresAt: true, patient: { select: { fullName: true } } } },
} satisfies Prisma.PaymentSelect;

export async function loadDashboard(db: PrismaClient, now = new Date()) {
  const day = freetownDayBounds(now);
  try {
    const [
      users,
      patients,
      appointments,
      appointmentsToday,
      upcoming,
      completed,
      cancelled,
      pendingPayments,
      paidPayments,
      failedPayments,
      appointmentGroups,
      paymentGroups,
      verificationGroups,
      overdueHolds,
      latePayments,
      recentAppointments,
      recentPayments,
      doctors,
      catalog,
    ] = await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.patientProfile.count({ where: { archivedAt: null } }),
      db.appointment.count(),
      db.appointment.count({ where: { startsAt: { gte: day.start, lt: day.end } } }),
      db.appointment.count({ where: { status: { in: [...UPCOMING_APPOINTMENT_STATUSES] }, startsAt: { gte: now } } }),
      db.appointment.count({ where: { status: "COMPLETED" } }),
      db.appointment.count({ where: { status: { in: [...CANCELLED_APPOINTMENT_STATUSES] } } }),
      db.payment.count({ where: { status: "PENDING" } }),
      db.payment.count({ where: { status: "PAID" } }),
      db.payment.count({ where: { status: { in: [...FAILED_PAYMENT_STATUSES] } } }),
      db.appointment.groupBy({ by: ["status"], _count: { _all: true } }),
      db.payment.groupBy({ by: ["status"], _count: { _all: true } }),
      db.doctorProfile.groupBy({ by: ["verificationStatus"], _count: { _all: true } }),
      db.appointment.count({ where: { status: "PENDING_PAYMENT", paymentHoldExpiresAt: { lte: now } } }),
      db.payment.count({ where: { status: "PAID", appointment: { status: "EXPIRED_UNPAID" } } }),
      db.appointment.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          status: true,
          mode: true,
          startsAt: true,
          feeAmount: true,
          currency: true,
          patient: { select: { fullName: true } },
          doctor: { select: { displayName: true } },
        },
      }),
      db.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          status: true,
          amountMinor: true,
          currency: true,
          createdAt: true,
          appointment: { select: { id: true } },
        },
      }),
      loadDoctorOverview(db),
      loadCatalogSummary(db),
    ]);
    return {
      ok: true as const,
      counts: {
        users,
        patients,
        appointments,
        appointmentsToday,
        upcoming,
        completed,
        cancelled,
        pendingPayments,
        paidPayments,
        failedPayments,
        overdueHolds,
        latePayments,
      },
      doctors,
      catalog,
      appointmentStatuses: appointmentGroups.map((row) => ({ status: row.status, label: appointmentStatusLabel(row.status), count: row._count._all })),
      paymentStatuses: paymentGroups.map((row) => ({ status: row.status, label: paymentStatusLabel(row.status), count: row._count._all })),
      verificationStatuses: verificationGroups.map((row) => ({ status: row.verificationStatus, count: row._count._all })),
      appointmentsRecent: recentAppointments.map((row) => ({
        id: row.id,
        status: row.status,
        mode: row.mode,
        startsAt: row.startsAt.toISOString(),
        fee: formatFee(row.feeAmount, row.currency),
        patient: row.patient.fullName,
        doctor: row.doctor.displayName,
      })),
      paymentsRecent: recentPayments.map((row) => ({
        id: row.id,
        status: row.status,
        amount: formatMinorMoney(row.amountMinor, row.currency),
        createdAt: row.createdAt.toISOString(),
        appointmentId: row.appointment.id,
      })),
    };
  } catch (error) {
    return failed(error);
  }
}

export async function loadReport(db: PrismaClient, range: { from: Date; toExclusive: Date }) {
  const created = { gte: range.from, lt: range.toExclusive };
  try {
    const [users, patients, appointments, payments, approvals, refunded] = await Promise.all([
      db.user.count({ where: { createdAt: created, deletedAt: null } }),
      db.patientProfile.count({ where: { createdAt: created } }),
      db.appointment.groupBy({ by: ["status"], where: { createdAt: created }, _count: { _all: true } }),
      db.payment.groupBy({
        by: ["status", "currency"],
        where: { createdAt: created },
        _count: { _all: true },
        _sum: { amountMinor: true },
      }),
      db.doctorProfile.count({ where: { verificationStatus: "APPROVED", verifiedAt: created } }),
      db.payment.count({ where: { createdAt: created, status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] } } }),
    ]);
    return {
      ok: true as const,
      users,
      patients,
      approvals,
      refunded,
      appointments: appointments.map((row) => ({ status: row.status, label: appointmentStatusLabel(row.status), count: row._count._all })),
      payments: payments.map((row) => ({
        status: row.status,
        label: paymentStatusLabel(row.status),
        currency: row.currency.trim(),
        count: row._count._all,
        amount: formatMinorMoney(row._sum.amountMinor ?? 0, row.currency),
      })),
    };
  } catch (error) {
    return failed(error);
  }
}

function mapPayment(row: Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>) {
  return {
    id: row.id,
    status: row.status,
    amount: formatMinorMoney(row.amountMinor, row.currency),
    providerCode: row.providerCode,
    providerReference: row.providerReference,
    createdAt: formatPlatformWhen(row.createdAt),
    payer: row.payer.email,
    patient: row.appointment.patient.fullName,
    appointmentId: row.appointment.id,
    appointmentStatus: row.appointment.status,
  };
}

export async function loadReconciliation(db: PrismaClient) {
  try {
    const [latePaid, paidElsewhere, unresolved, missingReference, recentEvents] = await Promise.all([
      db.payment.findMany({
        where: { status: "PAID", appointment: { status: "EXPIRED_UNPAID" } },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: paymentSelect,
      }),
      db.payment.findMany({
        where: {
          status: "PAID",
          appointment: { status: { notIn: ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "EXPIRED_UNPAID"] } },
        },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: paymentSelect,
      }),
      db.payment.findMany({
        where: { status: { in: ["FAILED", "REQUIRES_ACTION"] } },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: paymentSelect,
      }),
      db.payment.findMany({
        where: { status: "PENDING", providerReference: null },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: paymentSelect,
      }),
      db.paymentEvent.findMany({
        orderBy: { occurredAt: "desc" },
        take: 80,
        select: {
          id: true,
          status: true,
          occurredAt: true,
          providerCode: true,
          payment: { select: { id: true, status: true, appointmentId: true } },
        },
      }),
    ]);
    return {
      ok: true as const,
      latePaid: latePaid.map(mapPayment),
      paidElsewhere: paidElsewhere.map(mapPayment),
      unresolved: unresolved.map(mapPayment),
      missingReference: missingReference.map(mapPayment),
      eventMismatches: recentEvents
        .filter((event) => event.status !== event.payment.status)
        .slice(0, 40)
        .map((event) => ({
          id: event.id,
          paymentId: event.payment.id,
          appointmentId: event.payment.appointmentId,
          eventStatus: event.status,
          paymentStatus: event.payment.status,
          providerCode: event.providerCode,
          occurredAt: formatPlatformWhen(event.occurredAt),
        })),
    };
  } catch (error) {
    return failed(error);
  }
}

export async function loadOperationalIssues(db: PrismaClient, now = new Date()) {
  try {
    const [overdue, latePaid, failedNotifications, failedInvitations, pendingDoctors] = await Promise.all([
      db.appointment.findMany({
        where: { status: "PENDING_PAYMENT", paymentHoldExpiresAt: { lte: now } },
        orderBy: { paymentHoldExpiresAt: "asc" },
        take: 20,
        select: {
          id: true,
          paymentHoldExpiresAt: true,
          patient: { select: { fullName: true } },
          doctor: { select: { displayName: true } },
        },
      }),
      db.payment.findMany({
        where: { status: "PAID", appointment: { status: "EXPIRED_UNPAID" } },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, appointmentId: true, amountMinor: true, currency: true },
      }),
      db.notification.findMany({
        where: { status: "FAILED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, title: true, type: true, channel: true, createdAt: true, recipient: { select: { email: true } } },
      }),
      db.doctorInvitation.findMany({
        where: { deliveryStatus: "FAILED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, createdAt: true, doctor: { select: { id: true, fullName: true } } },
      }),
      db.doctorProfile.findMany({
        where: { verificationStatus: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
        orderBy: { submittedAt: "asc" },
        take: 20,
        select: { id: true, fullName: true, verificationStatus: true, submittedAt: true },
      }),
    ]);
    return {
      ok: true as const,
      overdue: overdue.map((row) => ({
        id: row.id,
        hold: row.paymentHoldExpiresAt ? formatPlatformWhen(row.paymentHoldExpiresAt) : "—",
        patient: row.patient.fullName,
        doctor: row.doctor.displayName,
      })),
      latePaid: latePaid.map((row) => ({
        id: row.id,
        appointmentId: row.appointmentId,
        amount: formatMinorMoney(row.amountMinor, row.currency),
      })),
      failedNotifications: failedNotifications.map((row) => ({
        id: row.id,
        title: row.title,
        type: row.type,
        channel: row.channel,
        createdAt: formatPlatformWhen(row.createdAt),
        recipient: row.recipient.email,
      })),
      failedInvitations: failedInvitations.map((row) => ({
        id: row.id,
        doctorId: row.doctor.id,
        doctor: row.doctor.fullName,
        createdAt: formatPlatformWhen(row.createdAt),
      })),
      pendingDoctors: pendingDoctors.map((row) => ({
        id: row.id,
        name: row.fullName,
        status: row.verificationStatus,
        submittedAt: row.submittedAt ? formatPlatformWhen(row.submittedAt) : "—",
      })),
    };
  } catch (error) {
    return failed(error);
  }
}
