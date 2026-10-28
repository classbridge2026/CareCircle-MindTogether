"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RESEND_RATE_LIMIT, VERIFY_RATE_LIMIT } from "@/lib/auth/constants";
import { createEmailDelivery } from "@/lib/auth/delivery";
import { normalizeEmail } from "@/lib/auth/email-address";
import { normalizePhone } from "@/lib/auth/phone";
import { appBaseUrlFromEnv } from "@/lib/auth/register-patient";
import { requestContext } from "@/lib/auth/request-context";
import { sharedRateLimiter } from "@/lib/auth/rate-limit";
import { isProductionCookieSecure, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import {
  clientVerificationMessage,
  resendVerification,
  verifyEmailToken,
  verifyPhoneCode,
  type VerificationFailure,
} from "@/lib/auth/verification";
import { prisma } from "@/lib/db/prisma";

export type VerifyFormState = VerificationFailure | { ok?: false; formMessage?: string };

const verifyLimiter = sharedRateLimiter("verification", VERIFY_RATE_LIMIT);
const resendLimiter = sharedRateLimiter("verification-resend", RESEND_RATE_LIMIT);

async function finishVerification(result: Awaited<ReturnType<typeof verifyEmailToken>>) {
  const clientResult = clientVerificationMessage(result);
  if (result.ok && result.sessionToken) {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(isProductionCookieSecure()));
    redirect("/patient");
  }
  return clientResult.ok ? { ok: false as const, formMessage: "Your contact is recorded. Sign in when the account is active." } : clientResult;
}

export async function verifyEmailAction(
  _previous: VerifyFormState,
  formData: FormData,
): Promise<VerifyFormState> {
  const rawToken = String(formData.get("token") ?? "").trim();
  if (!rawToken) {
    return { formMessage: "Enter the verification code from your email." };
  }
  const context = await requestContext();
  const result = await verifyEmailToken(prisma, {
    rawToken,
    now: new Date(),
    userAgent: context.userAgent,
    ipAddressHash: context.ipHash,
    rateLimiter: verifyLimiter,
    rateKey: `email:${context.ipHash}`,
  });
  return finishVerification(result);
}

export async function verifyPhoneAction(
  _previous: VerifyFormState,
  formData: FormData,
): Promise<VerifyFormState> {
  const phoneE164 = normalizePhone(String(formData.get("phone") ?? ""));
  const code = String(formData.get("code") ?? "").trim();
  if (!phoneE164) {
    return { formMessage: "Enter the phone number on the account." };
  }
  if (!/^\d{6}$/.test(code)) {
    return { formMessage: "Enter the 6-digit code." };
  }
  const context = await requestContext();
  const result = await verifyPhoneCode(prisma, {
    phoneE164,
    code,
    now: new Date(),
    userAgent: context.userAgent,
    ipAddressHash: context.ipHash,
    rateLimiter: verifyLimiter,
    rateKey: `phone:${context.ipHash}`,
  });
  return finishVerification(result);
}

export async function resendVerificationAction(
  _previous: VerifyFormState,
  formData: FormData,
): Promise<VerifyFormState> {
  const emailNormalized = normalizeEmail(String(formData.get("email") ?? ""));
  const phoneE164 = normalizePhone(String(formData.get("phone") ?? ""));
  if (!emailNormalized && !phoneE164) {
    return { formMessage: "Enter the email address or phone number on the account." };
  }
  const context = await requestContext();
  const result = await resendVerification(prisma, {
    emailNormalized,
    phoneE164,
    now: new Date(),
    rateLimiter: resendLimiter,
    rateKey: `resend:${context.ipHash}:${emailNormalized ?? phoneE164}`,
    emailDelivery: createEmailDelivery(),
    appBaseUrl: appBaseUrlFromEnv(context.origin),
  });
  return { formMessage: result.message };
}
