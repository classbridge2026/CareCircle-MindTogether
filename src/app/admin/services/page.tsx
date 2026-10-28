import type { Metadata } from "next";
import Link from "next/link";
import { CatalogPager, catalogQuery } from "@/components/admin/catalog-ui";
import { AdminIcon, type AdminIconName } from "@/components/admin/admin-icons";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadServices, readPage, readParam } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";
import { formatWhen } from "@/lib/doctors/invitation-email";
import { ServicesBoard, type ServiceRecord } from "./service-forms";

export const metadata: Metadata = { title: "Consultation services" };
export const dynamic = "force-dynamic";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const q = readParam(params.q);
  const status = readParam(params.status);
  const mode = readParam(params.mode);
  const page = readPage(params.page);
  const result = await loadServices(prisma, { q, status, mode, page });
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  const query = catalogQuery("/admin/services", { q, status, mode });
  const services: ServiceRecord[] = result.rows.map((service) => ({
    ...service,
    createdLabel: formatWhen(new Date(service.createdAt)),
    updatedLabel: formatWhen(new Date(service.updatedAt)),
  }));
  const filtered = Boolean(q || (status && status !== "ALL") || (mode && mode !== "ALL"));
  const statusOn = status === "ACTIVE" || status === "INACTIVE" ? status : "";
  const modeOn = mode === "ONLINE" || mode === "IN_PERSON" || mode === "ANY" ? mode : "";

  return (
    <main className="users-page">
      <header className="dash-lead">
        <div>
          <h1>Consultation services</h1>
          <p>Create, review, update, and retire the services patients can book. Fees stay in the database, and closing a service leaves appointments already booked in place.</p>
        </div>
      </header>
      <section className="stat-grid" aria-label="Service totals">
        <StatCard
          href={catalogQuery("/admin/services", { q })}
          label="Matching services"
          value={result.total}
          note={filtered ? "Current filters" : "Full catalog"}
          icon="service"
          color="#12304a"
          selected={!statusOn && !modeOn}
        />
        <StatCard
          href={catalogQuery("/admin/services", { q, status: statusOn === "ACTIVE" ? "" : "ACTIVE", mode: modeOn })}
          label="Active"
          value={result.summary.active}
          note="Open for new bookings"
          icon="verify"
          color="#0f766e"
          selected={statusOn === "ACTIVE"}
        />
        <StatCard
          href={catalogQuery("/admin/services", { q, status: statusOn, mode: modeOn === "ONLINE" ? "" : "ONLINE" })}
          label="Online"
          value={result.summary.online}
          note="Video consultations"
          icon="calendar"
          color="#1d4ed8"
          selected={modeOn === "ONLINE"}
        />
        <StatCard
          href={catalogQuery("/admin/services", { q, status: statusOn, mode: modeOn === "IN_PERSON" ? "" : "IN_PERSON" })}
          label="In person"
          value={result.summary.inPerson}
          note="Clinic visits"
          icon="location"
          color="#9a6700"
          selected={modeOn === "IN_PERSON"}
        />
      </section>
      <LiveQueryForm
        pathname="/admin/services"
        className="users-filters"
        fields={[
          { name: "q", label: "Search", kind: "text", value: q, placeholder: "Name, slug, or code", inputClassName: textInputClass },
          { name: "mode", label: "Mode", kind: "select", value: mode || "ALL", inputClassName: textInputClass, options: [
            { value: "ALL", label: "All modes" },
            { value: "ONLINE", label: "Online" },
            { value: "IN_PERSON", label: "In person" },
            { value: "ANY", label: "Either mode" },
          ] },
          { name: "status", label: "Status", kind: "select", value: status || "ALL", inputClassName: textInputClass, options: [
            { value: "ALL", label: "All statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ] },
        ]}
      />
      <ServicesBoard services={services} currency={result.currency} />
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={query} label="service" />
    </main>
  );
}

function StatCard({
  href,
  label,
  value,
  note,
  icon,
  color,
  selected,
}: {
  href: string;
  label: string;
  value: number;
  note: string;
  icon: AdminIconName;
  color: string;
  selected: boolean;
}) {
  return (
    <Link className={`stat-card${selected ? " is-selected" : ""}`} href={href} style={{ ["--stat" as string]: color }} aria-current={selected ? "true" : undefined}>
      <span className="stat-card-icon">
        <AdminIcon name={icon} />
      </span>
      <span className="stat-card-copy">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-label">{label}</span>
        <span className="stat-card-note">{note}</span>
      </span>
    </Link>
  );
}
