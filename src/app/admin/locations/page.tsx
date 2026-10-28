import type { Metadata } from "next";
import { CatalogPager, EmptyCatalog, PageHeader, catalogQuery } from "@/components/admin/catalog-ui";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { countryName } from "@/lib/catalog/countries";
import { loadLocations, readPage, readParam } from "@/lib/catalog/queries";
import { getSystemName } from "@/lib/brand/system-name";
import { prisma } from "@/lib/db/prisma";
import { CreateLocationForm, LocationEditor } from "./location-forms";

export const metadata: Metadata = { title: "Locations" };
export const dynamic = "force-dynamic";

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const q = readParam(params.q);
  const status = readParam(params.status);
  const district = readParam(params.district);
  const page = readPage(params.page);
  const result = await loadLocations(prisma, { q, status, district, page });
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  const query = catalogQuery("/admin/locations", { q, status, district });
  const systemName = await getSystemName();
  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Catalog"
        title="Platform locations"
        description={`${systemName} manages its own consultation locations. New locations default to Sierra Leone, and other countries can be added. Inactive locations stay on past appointments and are not offered for new ones.`}
      />
      <LiveQueryForm
        pathname="/admin/locations"
        className="grid gap-3 rounded-2xl border border-brand-line bg-white p-4 md:grid-cols-4"
        fields={[
          { name: "q", label: "Search", kind: "text", value: q, placeholder: "Name, city, or address", labelClassName: "text-sm font-medium md:col-span-2", inputClassName: `${textInputClass} mt-1` },
          { name: "district", label: "District", kind: "select", value: district, labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1`, options: [{ value: "", label: "All districts" }, ...result.districts.map((item) => ({ value: item, label: item }))] },
          { name: "status", label: "Status", kind: "select", value: status || "ALL", labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1`, options: [
            { value: "ALL", label: "All" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ] },
        ]}
      />
      <CreateLocationForm systemName={systemName} />
      {result.rows.length === 0 ? <EmptyCatalog>No locations match these filters.</EmptyCatalog> : null}
      <div className="grid gap-4">
        {result.rows.map((location) => (
          <LocationEditor key={location.id} systemName={systemName} location={{ ...location, countryLabel: countryName(location.countryCode) }} />
        ))}
      </div>
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={query} label="location" />
    </section>
  );
}
