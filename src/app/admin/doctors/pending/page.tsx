import type { Metadata } from "next";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { DoctorList } from "@/components/admin/doctor-list";
import { LiveQueryForm } from "@/components/live-query";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { prisma } from "@/lib/db/prisma";
import { loadDoctors } from "@/lib/doctors/queries";

export const metadata: Metadata = { title: "Pending verification" };
export const dynamic = "force-dynamic";

export default async function PendingDoctorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const q = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const page = Number((Array.isArray(params.page) ? params.page[0] : params.page) || "1");
  const result = await loadDoctors(prisma, { q, page, pendingOnly: true });
  return result.ok ? (
    <DoctorList
      title="Pending verification"
      description="Open a doctor to read the profile they submitted, then approve it or decline it."
      rows={result.rows}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      query={`/admin/doctors/pending?q=${encodeURIComponent(q)}`}
      filters={
        <LiveQueryForm
          pathname="/admin/doctors/pending"
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          fields={[{ name: "q", label: "Search", kind: "text", value: q, labelClassName: "text-sm font-medium text-brand-ink sm:flex-1", inputClassName: "mt-1 h-12 w-full rounded-xl border border-brand-line px-3" }]}
        />
      }
    />
  ) : (
    <RecordsUnavailable code={result.code} />
  );
}
