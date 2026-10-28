import type { Metadata } from "next";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { emailProviderConfigured, EMAIL_CONFIGURATION_HINT } from "@/lib/auth/delivery";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { AddDoctorForm } from "./add-doctor-form";

export const metadata: Metadata = { title: "Add doctor" };
export const dynamic = "force-dynamic";

export default async function AddDoctorPage() {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const specialties = await prisma.specialty.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  return (
    <section>
      <h1 className="text-3xl font-semibold tracking-tight text-brand-navy">Add doctor</h1>
      <p className="mt-2 max-w-2xl text-base leading-7 text-brand-muted">
        This creates a doctor account and a single-use invitation. The doctor sets their own password from the link. Public registration cannot create this account.
      </p>
      {specialties.length === 0 ? (
        <p role="alert" className="mt-6 rounded-xl border border-brand-line bg-white px-3 py-3 text-sm">
          No active specialties are available. Add one in Specialty Management before inviting a doctor. Mental Health is created by the initial database migration.
        </p>
      ) : null}
      <AddDoctorForm specialties={specialties} emailHint={emailProviderConfigured() ? null : EMAIL_CONFIGURATION_HINT} />
    </section>
  );
}
