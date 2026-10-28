import type { Metadata } from "next";
import { CatalogPager, EmptyCatalog, PageHeader, catalogQuery } from "@/components/admin/catalog-ui";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadPricing, readPage, readParam } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";
import { OfferingFeeForm, ServiceFeeForm } from "./pricing-forms";

export const metadata: Metadata = { title: "Fees and pricing" };
export const dynamic = "force-dynamic";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const q = readParam(params.q);
  const status = readParam(params.status);
  const page = readPage(params.page);
  const result = await loadPricing(prisma, { q, status, page });
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  const query = catalogQuery("/admin/pricing", { q, status });
  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Catalog"
        title="Fees and pricing"
        description={`The platform default currency is ${result.currency}. Each service has a default fee, and each doctor can charge a different price. Changing either one leaves fees already stored on appointments unchanged. Payment collection is not part of this screen.`}
      />
      <LiveQueryForm
        pathname="/admin/pricing"
        className="grid gap-3 rounded-2xl border border-brand-line bg-white p-4 sm:grid-cols-3"
        fields={[
          { name: "q", label: "Search", kind: "text", value: q, placeholder: "Service or doctor", labelClassName: "text-sm font-medium sm:col-span-2", inputClassName: `${textInputClass} mt-1` },
          { name: "status", label: "Status", kind: "select", value: status || "ALL", labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1`, options: [
            { value: "ALL", label: "All" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ] },
        ]}
      />
      {result.rows.length === 0 ? <EmptyCatalog>No services match these filters.</EmptyCatalog> : null}
      <div className="grid gap-4">
        {result.rows.map((service) => (
          <section key={service.id} className="grid gap-4">
            <ServiceFeeForm service={service} />
            {service.offerings.length > 0 ? (
              <div className="grid gap-3 rounded-2xl border border-brand-line bg-white px-5 py-4">
                <h3 className="text-sm font-semibold text-brand-navy">Doctor prices</h3>
                {service.offerings.map((offering) => (
                  <OfferingFeeForm key={offering.id} offering={offering} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-brand-muted">No doctor has a price for this service yet.</p>
            )}
          </section>
        ))}
      </div>
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={query} label="service" />
    </section>
  );
}
