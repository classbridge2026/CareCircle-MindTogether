import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/catalog-ui";
import { ProfilePhotoEditor } from "@/components/profile-photo";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Your photo" };
export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, profileImageUpdatedAt: true },
  });
  return (
    <main className="users-page">
      <PageHeader
        eyebrow="Your account"
        title="Your photo"
        description="Upload a profile photo. It appears in the administration bar and wherever your account is shown."
      />
      <section className="rounded-2xl border border-brand-line bg-white p-5">
        <ProfilePhotoEditor
          userId={user.id}
          name={account?.email ?? "Administrator"}
          version={account?.profileImageUpdatedAt?.toISOString() ?? null}
        />
      </section>
    </main>
  );
}
