import type { Metadata } from "next";
import Link from "next/link";
import { CatalogPager, PageHeader, catalogQuery } from "@/components/admin/catalog-ui";
import { Notice, RecordTable, TableCell } from "@/components/admin/portal-ui";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { StatusBadge } from "@/components/status-badge";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadPayments } from "@/lib/admin/directories";
import { formatPlatformWhen, paymentStatusLabel, paymentStatusTone } from "@/lib/admin/labels";
import { readPage, readParam } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const q = readParam(params.q);
  const status = readParam(params.status);
  const date = readParam(params.date);
  const page = readPage(params.page);
  const result = await loadPayments(prisma, { q, status, date, page });
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  return (
    <main className="grid gap-6">
      <PageHeader eyebrow="Operations" title="Payments" description="Payment records already stored for appointments. Nothing on this page marks a payment successful." />
      <Notice>No payment provider is integrated. Provider-dependent capture, refund, and status updates are unavailable.</Notice>
      <LiveQueryForm
        pathname="/admin/payments"
        className="grid gap-3 rounded-2xl border border-brand-line bg-white p-4 md:grid-cols-[minmax(0,1fr)_12rem_11rem] md:items-end"
        fields={[
          { name: "q", label: "Patient, payer, reference, or appointment", kind: "text", value: q, labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1` },
          { name: "status", label: "Status", kind: "select", value: status || "ALL", labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1`, options: [
            { value: "ALL", label: "All statuses" },
            { value: "PENDING", label: "Pending" },
            { value: "REQUIRES_ACTION", label: "Needs action" },
            { value: "PAID", label: "Paid" },
            { value: "FAILED_OR_REFUNDED", label: "Failed or refunded" },
            { value: "CANCELLED", label: "Cancelled" },
          ] },
          { name: "date", label: "Created", kind: "date", value: date, labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1` },
        ]}
      />
      <RecordTable
        title="Payments"
        caption="Payments"
        empty={result.payments.length === 0 ? "No payments match these filters." : undefined}
        columns={
          <colgroup>
            <col className="pay-col-created" />
            <col className="pay-col-patient" />
            <col className="pay-col-amount" />
            <col className="pay-col-provider" />
            <col className="pay-col-status" />
          </colgroup>
        }
        head={
          <>
            <th>Created</th>
            <th>Patient</th>
            <th>Amount</th>
            <th>Provider</th>
            <th>Status</th>
          </>
        }
        rows={result.payments.map((row) => (
          <tr key={row.id}>
            <TableCell label="Created">
              <Link className="users-email" href={`/admin/payments/${row.id}`}>
                {formatPlatformWhen(new Date(row.createdAt))}
              </Link>
            </TableCell>
            <TableCell label="Patient">{row.patient}</TableCell>
            <TableCell label="Amount">{row.amount}</TableCell>
            <TableCell label="Provider">
              {row.providerCode}
              <span className="users-sub">{row.providerReference ?? "No reference"}</span>
            </TableCell>
            <TableCell label="Status">
              <StatusBadge tone={paymentStatusTone(row.status)}>{paymentStatusLabel(row.status)}</StatusBadge>
            </TableCell>
          </tr>
        ))}
      />
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={catalogQuery("/admin/payments", { q, status, date })} label="payment" />
    </main>
  );
}
