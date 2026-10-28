import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { isUuid } from "@/lib/admin/rules";

export const metadata: Metadata = { title: "User" };
export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  redirect(`/admin/users?view=${id}`);
}
