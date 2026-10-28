import type { Metadata } from "next";
import Link from "next/link";
import { CatalogPager, catalogQuery } from "@/components/admin/catalog-ui";
import { AdminIcon, type AdminIconName } from "@/components/admin/admin-icons";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { readPage, readParam, loadSpecialties } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";
import { SpecialtiesBoard, type SpecialtyRecord } from "./specialty-forms";

export const metadata: Metadata = { title: "Specialties" };
export const dynamic = "force-dynamic";

export default async function SpecialtiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const q = readParam(params.q);
  const status = readParam(params.status);
  const page = readPage(params.page);
  const result = await loadSpecialties(prisma, { q, status, page });
  if (!result.ok) {
    return <RecordsUnavailable code={result.code} />;
  }
  const query = catalogQuery("/admin/specialties", { q, status });
  const specialties: SpecialtyRecord[] = result.rows;
  const filtered = Boolean(q || (status && status !== "ALL"));
  const statusOn = status === "ACTIVE" || status === "INACTIVE" ? status : "";

  return (
    <main className="users-page">
      <header className="dash-lead">
        <div>
          <h1>Specialties</h1>
          <p>Create, review, update, and retire the specialties doctors can claim. Deactivating a specialty leaves existing profiles and appointments in place.</p>
        </div>
      </header>
      <section className="stat-grid" aria-label="Specialty totals">
        <StatCard
          href={catalogQuery("/admin/specialties", { q })}
          label="Specialties"
          value={result.summary.active + result.summary.inactive}
          note={filtered ? "Matching the search" : "Full catalog"}
          icon="specialty"
          color="#12304a"
          selected={!statusOn}
        />
        <StatCard
          href={catalogQuery("/admin/specialties", { q, status: statusOn === "ACTIVE" ? "" : "ACTIVE" })}
          label="Active"
          value={result.summary.active}
          note="Open for new claims"
          icon="verify"
          color="#0f766e"
          selected={statusOn === "ACTIVE"}
        />
        <StatCard
          href={catalogQuery("/admin/specialties", { q, status: statusOn === "INACTIVE" ? "" : "INACTIVE" })}
          label="Inactive"
          value={result.summary.inactive}
          note="Hidden from new claims"
          icon="issue"
          color="#9a6700"
          selected={statusOn === "INACTIVE"}
        />
        <StatCard
          href={catalogQuery("/admin/specialties", { q, status: statusOn })}
          label="With doctors"
          value={result.summary.withDoctors}
          note="At least one doctor"
          icon="doctor"
          color="#1d4ed8"
          selected={false}
        />
      </section>
      <LiveQueryForm
        pathname="/admin/specialties"
        className="users-filters"
        fields={[
          { name: "q", label: "Search", kind: "text", value: q, placeholder: "Name, slug, or description", inputClassName: textInputClass },
          {
            name: "status",
            label: "Status",
            kind: "select",
            value: status || "ALL",
            inputClassName: textInputClass,
            options: [
              { value: "ALL", label: "All statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ],
          },
        ]}
      />
      <SpecialtiesBoard specialties={specialties} />
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={query} label="specialty" />
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
