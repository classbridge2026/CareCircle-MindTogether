"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/auth/password";
import { requestContext } from "@/lib/auth/request-context";
import { sharedRateLimiter } from "@/lib/auth/rate-limit";
import { isProductionCookieSecure, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { INVITATION_ACCEPT_RATE_LIMIT } from "@/lib/doctors/constants";
import { acceptDoctorInvitation } from "@/lib/doctors/invitations";

const acceptLimiter = sharedRateLimiter("doctor-invitation-accept", INVITATION_ACCEPT_RATE_LIMIT);

export type AcceptInvitationState = { formMessage?: string };

export async function acceptInvitationAction(
  _previous: AcceptInvitationState,
  formData: FormData,
): Promise<AcceptInvitationState> {
  const context = await requestContext();
  const result = await acceptDoctorInvitation(
    {
      token: String(formData.get("token") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    },
    {
      db: prisma,
      hashPassword,
      now: new Date(),
      rateLimiter: acceptLimiter,
      rateKey: `invite:${context.ipHash}`,
      userAgent: context.userAgent,
      ipAddressHash: context.ipHash,
      logError: (code) => console.error(code),
    },
  );
  if (!result.ok) {
    return { formMessage: result.formMessage };
  }
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(isProductionCookieSecure()));
  redirect("/doctor/onboarding");
}
