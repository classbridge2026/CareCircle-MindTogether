import type { Metadata } from "next";
import Link from "next/link";
import { EmptyCatalog, PageHeader } from "@/components/admin/catalog-ui";
import { Notice } from "@/components/admin/portal-ui";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { StatusBadge } from "@/components/status-badge";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { appointmentStatusLabel, paymentStatusLabel, paymentStatusTone } from "@/lib/admin/labels";
import { loadReconciliation } from "@/lib/admin/metrics";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Payment reconciliation" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  amount: string;
  patient: string;
  providerCode: string;
  providerReference: string | null;
  status: string;
  appointmentId: string;
  appointmentStatus: string;
};

function PaymentGroup({ title, description, rows }: { title: string; description: string; rows: Row[] }) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
        <p className="text-sm leading-6 text-brand-muted">{description}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyCatalog>No records in this group.</EmptyCatalog>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/admin/payments/${row.id}`} className="grid gap-1 rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <span>
                  <span className="block font-semibold text-brand-navy">
                    {row.amount} · {row.patient}
                  </span>
                  <span className="text-brand-muted">
                    {row.providerCode}
                    {row.providerReference ? ` · ${row.providerReference}` : " · no provider reference"} · appointment {appointmentStatusLabel(row.appointmentStatus)}
                  </span>
                </span>
                <StatusBadge tone={paymentStatusTone(row.status)}>{paymentStatusLabel(row.status)}</StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function ReconciliationPage() {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await loadReconciliation(prisma);
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  const clear = result.latePaid.length + result.paidElsewhere.length + result.unresolved.length + result.missingReference.length + result.eventMismatches.length === 0;
  return (
    <main className="grid gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Payment reconciliation"
        description="Exceptions derived from stored payments and provider events. This workspace does not change a payment to paid."
      />
      <Notice>Refunds and provider capture are unavailable until a payment provider is integrated. A payment received after an expired hold is flagged and does not confirm the appointment.</Notice>
      {clear ? <EmptyCatalog>No mismatched or unresolved payment records were found.</EmptyCatalog> : null}
      <PaymentGroup title="Paid after the hold was released" description="The payment is paid and the appointment is expired unpaid. Confirming it would reuse a released slot, so it stays flagged." rows={result.latePaid} />
      <PaymentGroup title="Paid without a confirmed visit" description="The payment is paid while the appointment is cancelled or otherwise not an active confirmed visit." rows={result.paidElsewhere} />
      <PaymentGroup title="Failed or waiting on the payer" description="Stored status is failed or requires action." rows={result.unresolved} />
      <PaymentGroup title="Pending without a provider reference" description="These cannot be matched to a provider payment because no provider is integrated." rows={result.missingReference} />
      <section className="grid gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Recent event mismatches</h2>
          <p className="text-sm leading-6 text-brand-muted">The latest 80 provider events were compared with the payment they belong to. Payloads are not shown.</p>
        </div>
        {result.eventMismatches.length === 0 ? (
          <EmptyCatalog>No recent provider event disagrees with its payment.</EmptyCatalog>
        ) : (
          <ul className="grid gap-2">
            {result.eventMismatches.map((row) => (
              <li key={row.id} className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm">
                <Link className="font-semibold text-brand-teal" href={`/admin/payments/${row.paymentId}`}>
                  Event {paymentStatusLabel(row.eventStatus)} · payment {paymentStatusLabel(row.paymentStatus)}
                </Link>
                <p className="text-brand-muted">
                  {row.providerCode} · {row.occurredAt}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
