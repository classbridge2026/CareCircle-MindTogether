import type { Metadata } from "next";
import { CatalogPager, catalogQuery } from "@/components/admin/catalog-ui";
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
  return (
    <main className="users-page">
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
