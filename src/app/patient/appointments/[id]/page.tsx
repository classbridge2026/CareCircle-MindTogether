import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { HoldCountdown } from "@/components/appointments/hold-countdown";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { StatusBadge } from "@/components/status-badge";
import { readPageSession } from "@/lib/auth/current-user";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { appointmentStatusLabel, paymentStatusLabel, paymentStatusTone } from "@/lib/admin/labels";
import { loadOwnedAppointment } from "@/lib/appointments/queries";
import { canTransition } from "@/lib/appointments/transitions";
import { prisma } from "@/lib/db/prisma";
import { listAppointmentPayments, releasedSummaryForAppointment } from "@/lib/patient/portal";
import { AppointmentOverview } from "@/components/consultation/overview";
import { describeVisitJoin } from "@/lib/consultations/view";
import { readPublicContact } from "@/lib/public/landing";
import { CancelAppointmentForm } from "./cancel-form";
import "@/components/consultation/consult.css";
import "./appointment-visit.css";

export const metadata: Metadata = { title: "Appointment" };
export const dynamic = "force-dynamic";

function durationLabel(startsAt: Date, endsAt: Date) {
  const minutes = Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000));
  return `${minutes} min`;
}

export default async function PatientAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const user = await readPageSession(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
  if (!user) return <RecordsUnavailable code="UNAVAILABLE" />;
  const result = await loadOwnedAppointment(prisma, { id, userId: user.id, as: "patient" });
  if (!result.ok) {
    if (result.code === "NOT_FOUND") notFound();
    return <RecordsUnavailable code={result.code} />;
  }
  const visit = result.appointment;
  const now = new Date();
  const canCancel = canTransition({
    actor: "patient",
    ownsRecord: true,
    from: visit.status,
    to: "CANCELLED_BY_PATIENT",
    now,
    startsAt: visit.startsAt,
    endsAt: visit.endsAt,
    reason: "Patient requested cancellation",
  }).ok;
  const canReschedule = canTransition({
    actor: "patient",
    ownsRecord: true,
    from: visit.status,
    to: "RESCHEDULED",
    now,
    startsAt: visit.startsAt,
    endsAt: visit.endsAt,
    reason: "Patient requested another time",
  }).ok && Boolean(visit.offeringId);
  const [payments, summary, followUps, contactRows] = await Promise.all([
    listAppointmentPayments(prisma, { appointmentId: visit.id, userId: user.id }),
    releasedSummaryForAppointment(prisma, { appointmentId: visit.id, userId: user.id }),
    prisma.appointment.findMany({
      where: { followUpOfId: visit.id, patientProfileId: visit.patient.id },
      orderBy: { startsAt: "asc" },
      select: { id: true },
      take: 1,
    }).catch(() => []),
    prisma.platformSetting.findMany({
      where: { key: "PUBLIC_CONTACT_EMAIL" },
      select: { key: true, valueJson: true },
    }).catch(() => []),
  ]);

  const holdOpen = visit.status === "PENDING_PAYMENT" && visit.paymentHoldExpiresAt && visit.paymentHoldExpiresAt > now;
  const paid = visit.paymentStatuses.includes("PAID");
  const online = visit.mode === "ONLINE";
  const join = describeVisitJoin({
    actorUserId: user.id,
    actorStatus: user.status,
    roleCodes: user.roleCodes,
    mode: visit.mode,
    status: visit.status,
    startsAt: visit.startsAt,
    endsAt: visit.endsAt,
    patientUserId: visit.patient.userId,
    doctorUserId: visit.doctor.userId,
    patientStatus: visit.patient.userStatus,
    doctorStatus: visit.doctor.userStatus,
    doctorDeletedAt: visit.doctor.deletedAt,
    doctorVerificationStatus: visit.doctor.verificationStatus,
    paymentStatuses: visit.paymentStatuses,
    when: visit.when,
    now,
    audience: "patient",
  });

  const supportEmail = readPublicContact(contactRows).email;
  const latestPayment = visit.paymentStatuses.at(-1);
  const completed = visit.status === "COMPLETED";
  const inProgress = online && visit.status === "IN_PROGRESS" && join.canJoin;

  return (
    <div className="visit-page">
      <AppointmentOverview
        backHref="/patient/appointments"
        backLabel="Back to appointments"
        personName={visit.doctor.displayName}
        personUserId={visit.doctor.userId}
        personImageVersion={visit.doctor.imageVersion}
        personDetail={visit.specialty}
        verified={visit.doctor.verificationStatus === "APPROVED"}
        service={visit.service}
        when={visit.when}
        duration={durationLabel(visit.startsAt, visit.endsAt)}
        modeLabel={online ? "Online consultation" : "In person"}
        statusLabel={appointmentStatusLabel(visit.status)}
        paymentLabel={latestPayment ? paymentStatusLabel(latestPayment) : paid ? "Paid" : "Not recorded"}
        reference={visit.id}
        instructions={visit.preparation}
        place={online ? null : visit.place}
        message={join.message}
        joinHref={!online || !join.canJoin || inProgress ? null : `/patient/appointments/${visit.id}/consultation`}
        secondaryHref={canReschedule && visit.offeringId ? `/patient/appointments/${visit.id}/reschedule` : null}
        secondaryLabel={canReschedule ? "Reschedule" : null}
        supportEmail={supportEmail}
        inProgressHref={inProgress ? `/patient/appointments/${visit.id}/consultation` : null}
        completed={completed ? {
          summaryHref: summary ? `/patient/summaries/${summary.id}` : null,
          followUpHref: followUps[0] ? `/patient/appointments/${followUps[0].id}` : null,
          bookHref: "/patient/find",
          returnHref: "/patient/appointments",
        } : null}
      />
      {visit.scheduleReason ? (
        <p className="visit-banner">The doctor approved this request at a new time. Reason: {visit.scheduleReason}</p>
      ) : null}
      {visit.patientConcern ? (
        <section className="visit-panel" aria-labelledby="patient-concern">
          <h2 id="patient-concern">What you told the doctor</h2>
          <p>{visit.patientConcern}</p>
        </section>
      ) : null}
      {visit.cancellationReason ? (
        <p className="visit-cancel-reason">
          <strong>Cancellation reason</strong>
          <span>{visit.cancellationReason}</span>
        </p>
      ) : null}
      {!online && !visit.place ? <p className="flow-note">Location details have not been provided yet.</p> : null}

      {visit.status === "PENDING_APPROVAL" ? (
        <p className="flow-note">This booking is waiting for the doctor to approve or decline it. It stays under Pending until then.</p>
      ) : null}
      {holdOpen && visit.paymentHoldExpiresAt ? (
        <div className="visit-banner">
          <HoldCountdown expiresAt={visit.paymentHoldExpiresAt.toISOString()} />
        </div>
      ) : null}

      <div className="visit-grid">
        <div className="grid gap-4">
          <section className="visit-panel">
            <h2>Payment status</h2>
            <p>{paid ? "A payment has been recorded for this visit." : visit.status === "PENDING_PAYMENT" ? "This visit is waiting on the recorded fee." : visit.status === "PENDING_APPROVAL" ? "The fee stays uncollected until the doctor approves this booking." : "The clinic has not collected this fee yet."}</p>
            {!payments.ok ? (
              <div className="mt-4"><RecordsUnavailable code={payments.code} /></div>
            ) : payments.payments.length === 0 ? (
              <p className="mt-3 visit-muted">No payment record is attached to this appointment.</p>
            ) : (
              <ul className="visit-list">
                {payments.payments.map((payment) => (
                  <li key={payment.id}>
                    <span>
                      <strong>{payment.amount}</strong>
                      <span>{payment.when}</span>
                    </span>
                    <StatusBadge tone={paymentStatusTone(payment.status)}>{paymentStatusLabel(payment.status)}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
            <Link className="visit-history" href="/patient/payments">Payment history</Link>
          </section>

          {canCancel ? (
            <section className="visit-panel visit-cancel">
              <CancelAppointmentForm appointmentId={visit.id} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
