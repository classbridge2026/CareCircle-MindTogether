import type { Metadata } from "next";
import { CatalogPager, EmptyCatalog, PageHeader, catalogQuery } from "@/components/admin/catalog-ui";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { readPage, readParam, loadSpecialties } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";
import { CreateSpecialtyForm, SpecialtyEditor } from "./specialty-forms";

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
  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Catalog"
        title="Specialties"
        description="Mental Health remains the first specialty. Add other specialties without changing application code. Deactivating a specialty leaves doctor profiles and appointments in place."
      />
      <LiveQueryForm
        pathname="/admin/specialties"
        className="grid gap-3 rounded-2xl border border-brand-line bg-white p-4 sm:grid-cols-3"
        fields={[
          { name: "q", label: "Search", kind: "text", value: q, placeholder: "Name, slug, or description", labelClassName: "text-sm font-medium sm:col-span-2", inputClassName: `${textInputClass} mt-1` },
          { name: "status", label: "Status", kind: "select", value: status || "ALL", labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1`, options: [
            { value: "ALL", label: "All" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ] },
        ]}
      />
      <CreateSpecialtyForm />
      {result.rows.length === 0 ? (
        <EmptyCatalog>No specialties match these filters.</EmptyCatalog>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {result.rows.map((specialty) => (
            <SpecialtyEditor key={specialty.id} specialty={specialty} />
          ))}
        </div>
      )}
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={query} label="specialty" />
    </section>
  );
}
