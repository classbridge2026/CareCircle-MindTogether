import { cache } from "react";
import { DOCTOR_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { isRecordsOffline } from "@/lib/db/offline";
import { isSchemaMismatch } from "@/lib/doctors/errors";
import { redirect } from "next/navigation";
import { recentInAppNotices } from "@/lib/notifications/delivery";
import { clinicalAccess, type ClinicalAccess } from "./present";

const loadDoctorAccount = cache(async () => {
  const user = await requireStoredRoles([DOCTOR_ROLE_CODE]);
  let name = "Clinician";
  let specialty = "Clinician";
  let imageVersion: string | null = null;
  let unread: number | null = null;
  let notices: Awaited<ReturnType<typeof recentInAppNotices>> = [];
  let access: ClinicalAccess = "missing";
  let doctor: { id: string; displayName: string; verificationStatus: string } | null = null;
  try {
    const [account, unreadCount, recent] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          profileImageUpdatedAt: true,
          doctorProfile: {
            select: {
              id: true,
              displayName: true,
              verificationStatus: true,
              specialties: {
                where: { isPrimary: true },
                take: 1,
                select: { specialty: { select: { name: true } } },
              },
            },
          },
        },
      }),
      prisma.notification.count({ where: { recipientId: user.id, readAt: null, channel: "IN_APP" } }),
      recentInAppNotices(prisma, user.id, "doctor"),
    ]);
    const profile = account?.doctorProfile;
    name = profile?.displayName || name;
    specialty = profile?.specialties[0]?.specialty.name || specialty;
    imageVersion = account?.profileImageUpdatedAt?.toISOString() ?? null;
    unread = unreadCount;
    notices = recent;
    access = clinicalAccess(profile?.verificationStatus);
    doctor = profile
      ? { id: profile.id, displayName: profile.displayName, verificationStatus: profile.verificationStatus }
      : null;
  } catch (error) {
    if (isRecordsOffline(error)) redirect("/offline");
    if (!isSchemaMismatch(error)) throw error;
    access = "schema";
  }
  return { user, name, specialty, imageVersion, unread, notices, access, doctor };
});

export async function loadDoctorChrome() {
  const account = await loadDoctorAccount();
  return {
    user: account.user,
    name: account.name,
    specialty: account.specialty,
    imageVersion: account.imageVersion,
    unread: account.unread,
    notices: account.notices,
    access: account.access,
  };
}

export async function requireClinicalPortal() {
  const account = await loadDoctorAccount();
  return { user: account.user, doctor: account.doctor, access: account.access };
}

export async function blockIfUnapproved(userId: string): Promise<string | null> {
  try {
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId }, select: { verificationStatus: true } });
    if (doctor?.verificationStatus !== "APPROVED") {
      return "Clinical actions stay unavailable until an administrator approves this account.";
    }
    return null;
  } catch {
    return "Clinical actions are unavailable right now.";
  }
}
