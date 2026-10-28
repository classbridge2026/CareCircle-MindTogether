import type { Metadata } from "next";
import Link from "next/link";
import { LiveQueryForm } from "@/components/live-query";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { StatusBadge } from "@/components/status-badge";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { formatMinorMoney, paymentStatusLabel, paymentStatusTone } from "@/lib/admin/labels";
import { prisma } from "@/lib/db/prisma";
import { listPatientPayments } from "@/lib/patient/portal";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default async function PatientPaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const query = await searchParams;
  const status = query.status ?? "all";
  const result = await listPatientPayments(prisma, user.id);
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  const rows = status === "all" ? result.payments : result.payments.filter((row) => row.status === status);
  const paidMinor = result.payments.filter((row) => row.status === "PAID").reduce((sum, row) => sum + row.amountMinor, 0);
  const pending = result.payments.filter((row) => row.status === "PENDING" || row.status === "REQUIRES_ACTION").length;
  const currency = result.payments.find((row) => row.status === "PAID")?.currency ?? result.payments[0]?.currency ?? "SLL";

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-2xl font-semibold text-[#0C2B45]">Payments & History</h1>
      </header>
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-[#d7e3ee] bg-white p-4">
          <p className="text-sm text-[#5b6b7c]">Total paid</p>
          <p className="mt-2 text-2xl font-semibold text-[#0C2B45]">{paidMinor > 0 ? formatMinorMoney(paidMinor, currency) : `0.00 ${currency}`}</p>
        </article>
        <article className="rounded-2xl border border-[#d7e3ee] bg-white p-4">
          <p className="text-sm text-[#5b6b7c]">Pending</p>
          <p className="mt-2 text-2xl font-semibold text-[#0C2B45]">{pending}</p>
        </article>
        <article className="rounded-2xl border border-[#d7e3ee] bg-white p-4">
          <p className="text-sm text-[#5b6b7c]">Records</p>
          <p className="mt-2 text-2xl font-semibold text-[#0C2B45]">{result.payments.length}</p>
        </article>
      </section>
      <LiveQueryForm
        pathname="/patient/payments"
        className="flex flex-wrap gap-2"
        fields={[{
          name: "status",
          label: "Status",
          kind: "select",
          value: status,
          labelClassName: "text-sm",
          inputClassName: "h-11 rounded-lg border border-[#d7e3ee] bg-white px-3",
          srOnly: true,
          options: [{ value: "all", label: "All statuses" }, ...["PENDING", "REQUIRES_ACTION", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "CANCELLED"].map((item) => ({ value: item, label: paymentStatusLabel(item) }))],
        }]}
      />
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-[#d7e3ee] bg-white p-5 text-sm text-[#5b6b7c]">No payment records match this view.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#d7e3ee] bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs tracking-wide text-[#5b6b7c] uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((payment) => (
                <tr key={payment.id} className="border-t border-[#e6eef5]">
                  <td className="px-4 py-3">{payment.when}</td>
                  <td className="px-4 py-3">{payment.service}<div className="text-xs text-[#5b6b7c]">{payment.doctor}</div></td>
                  <td className="px-4 py-3">{payment.amount}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={paymentStatusTone(payment.status)}>{paymentStatusLabel(payment.status)}</StatusBadge>
                    <Link className="ml-3 font-semibold text-[#0F766E]" href={`/patient/appointments/${payment.appointmentId}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
