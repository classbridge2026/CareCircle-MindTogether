"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { sendCareCircleEmail } from "@/lib/auth/delivery";
import { appBaseUrlFromEnv } from "@/lib/auth/register-patient";
import { requestContext } from "@/lib/auth/request-context";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { sharedRateLimiter } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db/prisma";
import { INVITATION_RESEND_RATE_LIMIT } from "@/lib/doctors/constants";
import { resendDoctorInvitation, revokeDoctorInvitation } from "@/lib/doctors/invitations";

const resendLimiter = sharedRateLimiter("doctor-invitation-resend", INVITATION_RESEND_RATE_LIMIT);

export type InvitationActionState = { message?: string; tone?: "ok" | "warn" | "error" };

export async function resendInvitationAction(
  _previous: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const context = await requestContext();
  const invitationId = String(formData.get("invitationId") ?? "");
  const result = await resendDoctorInvitation(
    { invitationId },
    {
      db: prisma,
      actor: { userId: user.id, roleCodes: user.roleCodes },
      deliver: sendCareCircleEmail,
      now: new Date(),
      appBaseUrl: appBaseUrlFromEnv(context.origin),
      rateLimiter: resendLimiter,
      rateKey: `resend:${user.id}:${invitationId}`,
      logError: (code) => {
        console.error(code);
      },
    },
  );
  revalidatePath("/admin/doctors/invitations");
  if (!result.ok) {
    return { message: result.message, tone: "error" };
  }
  return { message: result.message, tone: result.emailSent ? "ok" : "warn" };
}

export async function revokeInvitationAction(
  _previous: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await revokeDoctorInvitation(
    { invitationId: String(formData.get("invitationId") ?? "") },
    { db: prisma, actor: { userId: user.id, roleCodes: user.roleCodes }, now: new Date() },
  );
  revalidatePath("/admin/doctors/invitations");
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}
