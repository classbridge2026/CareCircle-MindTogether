import type { Metadata } from "next";
import { CatalogPager, catalogQuery } from "@/components/admin/catalog-ui";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadPricing, readPage, readParam } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";
import { FeeSchedule } from "./pricing-forms";

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
    <main className="users-page">
      <LiveQueryForm
        pathname="/admin/pricing"
        className="users-filters pricing-filters"
        fields={[
          { name: "q", label: "Search", kind: "text", value: q, placeholder: "Service or doctor", inputClassName: textInputClass },
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
      <FeeSchedule services={result.rows} currency={result.currency} />
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={query} label="service" />
    </main>
  );
}
