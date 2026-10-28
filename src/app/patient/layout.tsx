import { PatientShell } from "@/components/patient/shell";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { getSystemName } from "@/lib/brand/system-name";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { recentInAppNotices } from "@/lib/notifications/delivery";

export const dynamic = "force-dynamic";

async function loadPatientChrome(userId: string) {
  try {
    const [count, account, notices] = await Promise.all([
      prisma.notification.count({ where: { recipientId: userId, channel: "IN_APP", readAt: null } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { profileImageUpdatedAt: true, patientProfile: { select: { fullName: true } } },
      }),
      recentInAppNotices(prisma, userId, "patient"),
    ]);
    return {
      unread: count,
      name: account?.patientProfile?.fullName ?? "Patient",
      imageVersion: account?.profileImageUpdatedAt?.toISOString() ?? null,
      notices,
    };
  } catch {
    return { unread: 0, name: "Patient", imageVersion: null as string | null, notices: [] };
  }
}

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const [chrome, systemName] = await Promise.all([loadPatientChrome(user.id), getSystemName()]);
  const { unread, name, imageVersion, notices } = chrome;
  return (
    <PatientShell userId={user.id} name={name} systemName={systemName} imageVersion={imageVersion} unread={unread} notices={notices}>
      {children}
    </PatientShell>
  );
}
