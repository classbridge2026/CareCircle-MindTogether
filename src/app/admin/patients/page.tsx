import type { Metadata } from "next";
import { CatalogPager, catalogQuery } from "@/components/admin/catalog-ui";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadPatients } from "@/lib/admin/directories";
import { formatPlatformWhen, userStatusLabel, userStatusTone } from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/rules";
import { readPage, readParam } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";
import { PatientsBoard } from "./patients-board";

export const metadata: Metadata = { title: "Patients" };
export const dynamic = "force-dynamic";

export default async function PatientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const q = readParam(params.q);
  const status = readParam(params.status);
  const page = readPage(params.page);
  const requestedView = readParam(params.view);
  const initialViewId = isUuid(requestedView) ? requestedView : null;
  const result = await loadPatients(prisma, { q, status, page });
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  const rows = result.patients.map((patient) => ({
    id: patient.id,
    userId: patient.userId,
    fullName: patient.fullName,
    email: patient.email,
    phone: patient.phone,
    timezone: patient.timezone,
    status: patient.status,
    statusLabel: userStatusLabel(patient.status),
    statusTone: userStatusTone(patient.status),
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth,
    nationality: patient.nationality,
    residentialAddress: patient.residentialAddress,
    preferredLanguage: patient.preferredLanguage,
    emergencyContactName: patient.emergencyContactName,
    isDependent: patient.isDependent,
    appointments: patient.appointments,
    createdLabel: formatPlatformWhen(new Date(patient.createdAt)),
    canManage: actor.id !== patient.userId,
    imageVersion: patient.imageVersion,
  }));
  return (
    <main className="users-page">
      <LiveQueryForm
        pathname="/admin/patients"
        className="users-filters"
        fields={[
          { name: "q", label: "Search", kind: "text", value: q, placeholder: "Name or email", labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1` },
          { name: "status", label: "Account status", kind: "select", value: status || "ALL", labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1`, options: [
            { value: "ALL", label: "All statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "SUSPENDED", label: "Suspended" },
            { value: "PENDING_VERIFICATION", label: "Pending verification" },
            { value: "DISABLED", label: "Disabled" },
          ] },
        ]}
      />
      <PatientsBoard rows={rows} initialViewId={initialViewId} />
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={catalogQuery("/admin/patients", { q, status })} label="patient" />
    </main>
  );
}
