import type { Metadata } from "next";
import Link from "next/link";
import { EmptyCatalog, PageHeader } from "@/components/admin/catalog-ui";
import { Notice } from "@/components/admin/portal-ui";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadOperationalIssues } from "@/lib/admin/metrics";
import { prisma } from "@/lib/db/prisma";
import { ProcessHoldsForm } from "./process-form";

export const metadata: Metadata = { title: "Operational issues" };
export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await loadOperationalIssues(prisma);
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  const empty = result.overdue.length + result.latePaid.length + result.failedNotifications.length + result.failedInvitations.length + result.pendingDoctors.length === 0;
  return (
    <main className="grid gap-6">
      <PageHeader eyebrow="Operations" title="Operational issues" description="Exceptions derived from appointments, payments, invitations, notifications, and doctor verification. No separate issue log is invented." />
      {empty ? <EmptyCatalog>No operational exceptions are recorded.</EmptyCatalog> : null}
      <section className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-navy">Expired unpaid holds</h2>
        <p className="text-sm leading-6 text-brand-muted">These bookings are still pending payment after the hold time. Processing them uses the existing expiry routine and writes an appointment event.</p>
        {result.overdue.length === 0 ? (
          <p className="text-sm text-brand-muted">No overdue holds are waiting.</p>
        ) : (
          <ul className="grid gap-2">
            {result.overdue.map((row) => (
              <li key={row.id}>
                <Link className="font-semibold text-brand-teal" href={`/admin/appointments/${row.id}`}>
                  {row.patient} with {row.doctor}
                </Link>
                <p className="text-sm text-brand-muted">Hold ended {row.hold}</p>
              </li>
            ))}
          </ul>
        )}
        <ProcessHoldsForm />
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-brand-navy">Late payments</h2>
        {result.latePaid.length === 0 ? (
          <p className="text-sm text-brand-muted">No paid record is attached to an expired booking.</p>
        ) : (
          <ul className="grid gap-2">
            {result.latePaid.map((row) => (
              <li key={row.id} className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm">
                <Link className="font-semibold text-brand-teal" href={`/admin/payments/${row.id}`}>
                  {row.amount}
                </Link>
                <p className="text-brand-muted">Appointment remains expired unpaid. Automatic confirmation is not available.</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-brand-navy">Failed notification delivery</h2>
        {result.failedNotifications.length === 0 ? (
          <p className="text-sm text-brand-muted">No failed notification deliveries are stored.</p>
        ) : (
          <ul className="grid gap-2">
            {result.failedNotifications.map((row) => (
              <li key={row.id} className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm">
                <p className="font-semibold text-brand-navy">{row.title}</p>
                <p className="text-brand-muted">
                  {row.channel} · {row.type} · {row.recipient} · {row.createdAt}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-brand-navy">Failed doctor invitations</h2>
        {result.failedInvitations.length === 0 ? (
          <p className="text-sm text-brand-muted">No invitation emails are marked failed.</p>
        ) : (
          <ul className="grid gap-2">
            {result.failedInvitations.map((row) => (
              <li key={row.id} className="text-sm">
                <Link className="font-semibold text-brand-teal" href={`/admin/doctors/${row.doctorId}`}>
                  {row.doctor}
                </Link>
                <span className="text-brand-muted"> · {row.createdAt}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-brand-navy">Incomplete doctor verification</h2>
        <Notice>
          <Link className="font-semibold text-brand-teal" href="/admin/doctors/pending">
            Open the verification queue
          </Link>
        </Notice>
        {result.pendingDoctors.length === 0 ? (
          <p className="text-sm text-brand-muted">No doctor is waiting for verification.</p>
        ) : (
          <ul className="grid gap-2">
            {result.pendingDoctors.map((row) => (
              <li key={row.id} className="text-sm">
                <Link className="font-semibold text-brand-teal" href={`/admin/doctors/${row.id}`}>
                  {row.name}
                </Link>
                <span className="text-brand-muted">
                  {" "}
                  · {row.status === "UNDER_REVIEW" ? "Under review" : "Submitted"} · {row.submittedAt}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
