"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { REGISTRATION_RATE_LIMIT } from "@/lib/auth/constants";
import { hashPassword } from "@/lib/auth/password";
import { registerPatient, appBaseUrlFromEnv, type PublicRegistrationResult } from "@/lib/auth/register-patient";
import { requestContext } from "@/lib/auth/request-context";
import { sharedRateLimiter } from "@/lib/auth/rate-limit";
import { isProductionCookieSecure, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formDataToRegistration } from "@/lib/validation/registration";

export type RegistrationFormState = PublicRegistrationResult;

const initialLimiter = sharedRateLimiter("patient-registration", REGISTRATION_RATE_LIMIT);

export async function registerPatientAction(
  _previous: RegistrationFormState,
  formData: FormData,
): Promise<RegistrationFormState> {
  const context = await requestContext();
  const result = await registerPatient(formDataToRegistration(formData), {
    db: prisma,
    hashPassword,
    rateLimiter: initialLimiter,
    ipHash: context.ipHash,
    now: () => new Date(),
    appBaseUrl: appBaseUrlFromEnv(context.origin),
    logError: (code) => {
      console.error(code);
    },
  });
  if (!result.ok) {
    return result;
  }
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(isProductionCookieSecure()));
  redirect("/patient");
}
