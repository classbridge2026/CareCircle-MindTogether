import type { Metadata } from "next";
import Link from "next/link";
import { CatalogPager, PageHeader, catalogQuery } from "@/components/admin/catalog-ui";
import { RecordTable, TableCell } from "@/components/admin/portal-ui";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadConfiguration, readPage, readParam } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";
import { formatWhen } from "@/lib/doctors/invitation-email";
import { CurrencyForm } from "./currency-form";

export const metadata: Metadata = { title: "Configuration" };
export const dynamic = "force-dynamic";

function settingLabel(key: string, value: unknown): string {
  if (key === "APPOINTMENT_PAYMENT_HOLD_MINUTES") {
    return typeof value === "number" ? `${value} minutes` : "Not set";
  }
  if (value === true) return "Enabled";
  if (value === false) return "Disabled";
  if (typeof value === "string") return value;
  return "Not set";
}

const settingNames: Record<string, string> = {
  MINOR_REGISTRATION_ENABLED: "Minor registration",
  MINOR_TREATMENT_ENABLED: "Minor treatment",
  APPOINTMENT_PAYMENT_HOLD_MINUTES: "Appointment payment hold",
  DEFAULT_CURRENCY: "Default currency",
  SYSTEM_NAME: "System name",
};

export default async function ConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const q = readParam(params.q);
  const page = readPage(params.page);
  const result = await loadConfiguration(prisma, { q, page });
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  const query = catalogQuery("/admin/configuration", { q });
  const statusRows = [
    ["Active specialties", result.counts.activeSpecialties, "/admin/specialties?status=ACTIVE"],
    ["Inactive specialties", result.counts.inactiveSpecialties, "/admin/specialties?status=INACTIVE"],
    ["Active services", result.counts.activeServices, "/admin/services?status=ACTIVE"],
    ["Inactive services", result.counts.inactiveServices, "/admin/services?status=INACTIVE"],
    ["Active locations", result.counts.activeLocations, "/admin/locations?status=ACTIVE"],
    ["Inactive locations", result.counts.inactiveLocations, "/admin/locations?status=INACTIVE"],
    ["Approved doctors with active offerings", result.counts.doctorsWithOfferings, "/admin/offerings?status=ACTIVE"],
  ] as const;
  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Catalog"
        title="Configuration and status"
        description="Review which catalog records are active, set the platform default currency, and read recent administrative changes. Account roles are not granted from this page."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {statusRows.map(([label, count, href]) => (
          <Link key={label} href={href} className="rounded-2xl border border-brand-line bg-white px-5 py-4">
            <p className="text-sm text-brand-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-brand-navy">{count}</p>
          </Link>
        ))}
      </div>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-brand-navy">Platform settings</h2>
        <CurrencyForm currency={result.currency} />
        <dl className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5 sm:grid-cols-2">
          {result.settings.map((setting) => (
            <div key={setting.key}>
              <dt className="text-sm text-brand-muted">{settingNames[setting.key] ?? setting.key}</dt>
              <dd className="text-base font-semibold text-brand-navy">{settingLabel(setting.key, setting.value)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="grid gap-3">
        <LiveQueryForm
          pathname="/admin/configuration"
          className="grid gap-3 rounded-2xl border border-brand-line bg-white p-4"
          fields={[{ name: "q", label: "Search audit events", kind: "text", value: q, placeholder: "Action or record type", labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1` }]}
        />
        <RecordTable
          title="Recent catalog changes"
          caption="Recent catalog changes"
          empty={result.audits.length === 0 ? "No catalog changes match this search." : undefined}
          columns={
            <colgroup>
              <col className="config-col-when" />
              <col className="config-col-action" />
              <col className="config-col-record" />
              <col className="config-col-admin" />
            </colgroup>
          }
          head={
            <>
              <th>When</th>
              <th>Action</th>
              <th>Record</th>
              <th>Administrator</th>
            </>
          }
          rows={result.audits.map((audit) => (
            <tr key={audit.id}>
              <TableCell label="When">{formatWhen(new Date(audit.occurredAt))}</TableCell>
              <TableCell label="Action">{audit.action}</TableCell>
              <TableCell label="Record">{audit.entityType}</TableCell>
              <TableCell label="Administrator">{audit.actor}</TableCell>
            </tr>
          ))}
        />
        <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={query} label="event" />
      </section>
    </section>
  );
}
