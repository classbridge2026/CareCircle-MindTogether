import type { Metadata } from "next";
import "./admin.css";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { AdminShell } from "@/components/admin/admin-shell";
import { getSystemName } from "@/lib/brand/system-name";
import { isRecordsOffline } from "@/lib/db/offline";
import { prisma } from "@/lib/db/prisma";
import { recentInAppNotices } from "@/lib/notifications/delivery";
import { redirectOffline } from "@/lib/db/offline-redirect";

export const metadata: Metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

async function loadAdminChrome(userId: string) {
  try {
    const [account, unreadNotifications, notices] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, profileImageUpdatedAt: true },
      }),
      prisma.notification.count({ where: { recipientId: userId, readAt: null } }).catch(() => null),
      recentInAppNotices(prisma, userId, "admin"),
    ]);
    return { account, unreadNotifications, notices };
  } catch (error) {
    if (isRecordsOffline(error)) await redirectOffline();
    throw error;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const [chrome, systemName] = await Promise.all([loadAdminChrome(user.id), getSystemName()]);
  const { account, unreadNotifications, notices } = chrome;
  return (
    <AdminShell
      userId={user.id}
      email={account?.email ?? "Administrator"}
      systemName={systemName}
      imageVersion={account?.profileImageUpdatedAt?.toISOString() ?? null}
      roleLabel={user.roleCodes.includes(SUPER_ADMIN_ROLE_CODE) ? "Super administrator" : "Administrator"}
      unreadNotifications={unreadNotifications}
      notices={notices}
    >
      {children}
    </AdminShell>
  );
}
