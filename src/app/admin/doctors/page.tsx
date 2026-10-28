import type { Metadata } from "next";
import { CatalogPager } from "@/components/admin/catalog-ui";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { accountBadge, verificationBadge } from "@/components/status-badge";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { emailProviderConfigured, EMAIL_CONFIGURATION_HINT } from "@/lib/auth/delivery";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { formatPlatformDay } from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/rules";
import { prisma } from "@/lib/db/prisma";
import { loadDoctors } from "@/lib/doctors/queries";
import { DoctorsBoard } from "./all/doctors-board";

export const metadata: Metadata = { title: "Doctors" };
export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AdminDoctorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const q = one(params.q);
  const verification = one(params.verification);
  const account = one(params.account);
  const page = Number(one(params.page) || "1");
  const requestedView = one(params.view);
  const initialViewId = isUuid(requestedView) ? requestedView : null;
  const [result, specialties] = await Promise.all([
    loadDoctors(prisma, { q, verification, account, page }),
    prisma.specialty.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  const query = `/admin/doctors?q=${encodeURIComponent(q)}&verification=${encodeURIComponent(verification)}&account=${encodeURIComponent(account)}`;
  const rows = result.rows.map((doctor) => {
    const verificationBadgeValue = verificationBadge(doctor.verificationStatus);
    const accountBadgeValue = accountBadge(doctor.user.status);
    const primary = doctor.specialties.find((item) => item.isPrimary) ?? doctor.specialties[0];
    const extra = doctor.specialties.length > 1 ? ` +${doctor.specialties.length - 1}` : "";
    return {
      id: doctor.id,
      userId: doctor.user.id,
      imageVersion: doctor.user.profileImageUpdatedAt?.toISOString() ?? null,
      fullName: doctor.fullName,
      displayName: doctor.displayName,
      email: doctor.user.email,
      phone: doctor.user.phoneE164 ?? "",
      specialtyLabel: primary ? `${primary.specialty.name}${extra}` : "None declared",
      verificationLabel: verificationBadgeValue.label,
      verificationTone: verificationBadgeValue.tone,
      accountLabel: accountBadgeValue.label,
      accountTone: accountBadgeValue.tone,
      createdLabel: formatPlatformDay(doctor.createdAt),
      qualificationTitle: doctor.qualificationTitle ?? "",
      yearsExperience: doctor.yearsExperience === null ? "" : String(doctor.yearsExperience),
      biography: doctor.biography ?? "",
      canManage: actor.id !== doctor.user.id,
    };
  });
  return (
    <main className="users-page">
      <LiveQueryForm
        pathname="/admin/doctors"
        className="users-filters"
        fields={[
          { name: "q", label: "Search", kind: "text", value: q, placeholder: "Name or email", inputClassName: textInputClass },
          { name: "verification", label: "Verification", kind: "select", value: verification || "ALL", inputClassName: textInputClass, options: [
            { value: "ALL", label: "All" },
            { value: "DRAFT", label: "Profile incomplete" },
            { value: "SUBMITTED", label: "Verification pending" },
            { value: "UNDER_REVIEW", label: "Under review" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
            { value: "SUSPENDED", label: "Suspended" },
          ] },
          { name: "account", label: "Account", kind: "select", value: account || "ALL", inputClassName: textInputClass, options: [
            { value: "ALL", label: "All" },
            { value: "PENDING_VERIFICATION", label: "Invitation pending" },
            { value: "ACTIVE", label: "Active" },
            { value: "SUSPENDED", label: "Suspended" },
            { value: "DISABLED", label: "Disabled" },
          ] },
        ]}
      />
      <DoctorsBoard rows={rows} specialties={specialties} emailHint={emailProviderConfigured() ? null : EMAIL_CONFIGURATION_HINT} initialViewId={initialViewId} />
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={query} label="doctor" />
    </main>
  );
}
