import type { Metadata } from "next";
import { EmptyCatalog, PageHeader } from "@/components/admin/catalog-ui";
import { Notice, StatusBars } from "@/components/admin/portal-ui";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadReport } from "@/lib/admin/metrics";
import { parseReportRange } from "@/lib/admin/rules";
import { readParam } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Reports and analytics" };
export const dynamic = "force-dynamic";

function inputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const from = readParam(params.from);
  const to = readParam(params.to);
  const now = new Date();
  const range = parseReportRange(from, to, now);
  return (
    <main className="grid gap-6">
      <PageHeader eyebrow="Platform" title="Reports and analytics" description="Totals counted from records created in the selected Africa/Freetown dates. The range is limited to 366 days." />
      {"error" in range ? (
        <Notice>{range.error}</Notice>
      ) : (
        <ReportBody from={inputDate(range.from)} to={inputDate(new Date(range.toExclusive.getTime() - 86_400_000))} range={range} />
      )}
      {"error" in range ? (
        <LiveQueryForm
          pathname="/admin/reports"
          className="grid gap-3 rounded-2xl border border-brand-line bg-white p-4 sm:grid-cols-2 sm:items-end"
          fields={[
            { name: "from", label: "From", kind: "date", value: from, labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1` },
            { name: "to", label: "To", kind: "date", value: to, labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1` },
          ]}
        />
      ) : null}
    </main>
  );
}

async function ReportBody({ from, to, range }: { from: string; to: string; range: { from: Date; toExclusive: Date } }) {
  const report = await loadReport(prisma, range);
  if (!report.ok) return <RecordsUnavailable code={report.code} />;
  const appointmentTotal = report.appointments.reduce((sum, row) => sum + row.count, 0);
  const paymentTotal = report.payments.reduce((sum, row) => sum + row.count, 0);
  return (
    <>
      <LiveQueryForm
        pathname="/admin/reports"
        className="grid gap-3 rounded-2xl border border-brand-line bg-white p-4 sm:grid-cols-2 sm:items-end"
        fields={[
          { name: "from", label: "From", kind: "date", value: from, labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1` },
          { name: "to", label: "To", kind: "date", value: to, labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1` },
        ]}
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["New users", report.users],
          ["New patients", report.patients],
          ["Appointments created", appointmentTotal],
          ["Doctors approved", report.approvals],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-2xl border border-brand-line bg-white px-4 py-4">
            <p className="text-sm text-brand-muted">{label}</p>
            <p className="mt-1 text-3xl font-semibold text-brand-navy">{value}</p>
          </article>
        ))}
      </section>
      {appointmentTotal === 0 && paymentTotal === 0 && report.users === 0 ? <EmptyCatalog>No users, appointments, or payments were created in this range.</EmptyCatalog> : null}
      <section className="grid gap-4 xl:grid-cols-2">
        <StatusBars title="Appointments by status" rows={report.appointments.map((row) => ({ key: row.status, label: row.label, count: row.count }))} />
        <StatusBars title="Payments by status" rows={report.payments.map((row) => ({ key: `${row.status}-${row.currency}`, label: `${row.label} (${row.currency})`, count: row.count }))} />
      </section>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold text-brand-navy">Payment amounts</h2>
        {report.payments.length === 0 ? (
          <p className="text-sm text-brand-muted">No payments were created in this range.</p>
        ) : (
          <ul className="grid gap-2">
            {report.payments.map((row) => (
              <li key={`${row.status}-${row.currency}`} className="flex flex-wrap justify-between gap-2 rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm">
                <span>
                  {row.label} · {row.currency}
                </span>
                <span className="font-semibold text-brand-navy">
                  {row.count} · {row.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-brand-muted">{report.refunded} of those payments are refunded or partially refunded.</p>
      </section>
    </>
  );
}
