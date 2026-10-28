import type { Metadata } from "next";
import Link from "next/link";
import { CatalogPager, catalogQuery } from "@/components/admin/catalog-ui";
import { AdminIcon, type AdminIconName } from "@/components/admin/admin-icons";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadOfferingWorkspace, readPage, readParam } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";
import { formatWhen } from "@/lib/doctors/invitation-email";
import { OfferingsBoard, type OfferingRecord } from "./offering-forms";

export const metadata: Metadata = { title: "Doctor offerings" };
export const dynamic = "force-dynamic";

export default async function OfferingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const q = readParam(params.q);
  const doctorId = readParam(params.doctorId);
  const specialtyId = readParam(params.specialtyId);
  const serviceId = readParam(params.serviceId);
  const status = readParam(params.status);
  const mode = readParam(params.mode);
  const page = readPage(params.page);
  const result = await loadOfferingWorkspace(prisma, { q, doctorId, specialtyId, serviceId, status, mode, page });
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  const query = catalogQuery("/admin/offerings", { q, doctorId, specialtyId, serviceId, status, mode });
  const offerings: OfferingRecord[] = result.rows.map((offering) => ({
    ...offering,
    createdLabel: formatWhen(new Date(offering.createdAt)),
    updatedLabel: formatWhen(new Date(offering.updatedAt)),
  }));
  const statusOn = status === "ACTIVE" || status === "INACTIVE" ? status : "";
  const modeOn = mode === "ONLINE" || mode === "IN_PERSON" ? mode : "";
  const filtered = Boolean(q || doctorId || specialtyId || serviceId || statusOn || modeOn);
  const shared = { q, doctorId, specialtyId, serviceId };

  return (
    <main className="users-page">
      <header className="dash-lead">
        <div>
          <h1>Approved doctor offerings</h1>
          <p>Assign a consultation service to an approved doctor, set the doctor’s fee, and choose whether the visit is online or in person.</p>
        </div>
      </header>
      <section className="stat-grid" aria-label="Offering totals">
        <StatCard
          href={catalogQuery("/admin/offerings", shared)}
          label="Matching offerings"
          value={result.total}
          note={filtered ? "Current filters" : "Full catalog"}
          icon="offering"
          color="#12304a"
          selected={!statusOn && !modeOn}
        />
        <StatCard
          href={catalogQuery("/admin/offerings", { ...shared, status: statusOn === "ACTIVE" ? "" : "ACTIVE", mode: modeOn })}
          label="Active"
          value={result.summary.active}
          note="Open for new bookings"
          icon="verify"
          color="#0f766e"
          selected={statusOn === "ACTIVE"}
        />
        <StatCard
          href={catalogQuery("/admin/offerings", { ...shared, status: statusOn, mode: modeOn === "ONLINE" ? "" : "ONLINE" })}
          label="Online"
          value={result.summary.online}
          note="Video consultations"
          icon="calendar"
          color="#1d4ed8"
          selected={modeOn === "ONLINE"}
        />
        <StatCard
          href={catalogQuery("/admin/offerings", { ...shared, status: statusOn, mode: modeOn === "IN_PERSON" ? "" : "IN_PERSON" })}
          label="In person"
          value={result.summary.inPerson}
          note="Clinic visits"
          icon="location"
          color="#9a6700"
          selected={modeOn === "IN_PERSON"}
        />
      </section>
      <LiveQueryForm
        pathname="/admin/offerings"
        className="users-filters offerings-filters"
        fields={[
          { name: "q", label: "Search", kind: "text", value: q, placeholder: "Doctor, specialty, or service", inputClassName: textInputClass },
          { name: "doctorId", label: "Doctor", kind: "select", value: doctorId, inputClassName: textInputClass, options: [{ value: "", label: "All doctors" }, ...result.doctors.map((doctor) => ({ value: doctor.id, label: doctor.fullName }))] },
          { name: "specialtyId", label: "Specialty", kind: "select", value: specialtyId, inputClassName: textInputClass, options: [{ value: "", label: "All specialties" }, ...result.specialties.map((specialty) => ({ value: specialty.id, label: specialty.name }))] },
          { name: "serviceId", label: "Service", kind: "select", value: serviceId, inputClassName: textInputClass, options: [{ value: "", label: "All services" }, ...result.services.map((service) => ({ value: service.id, label: service.name }))] },
          { name: "status", label: "Status", kind: "select", value: status || "ALL", inputClassName: textInputClass, options: [
            { value: "ALL", label: "All statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ] },
        ]}
      />
      <OfferingsBoard offerings={offerings} doctors={result.eligibleDoctors} services={result.services} currency={result.currency} />
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={query} label="offering" />
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
