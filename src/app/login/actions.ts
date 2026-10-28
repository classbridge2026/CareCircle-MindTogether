"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticatePatient } from "@/lib/auth/login";
import { loginIdentifierError } from "@/lib/auth/login-identifier";
import { requestContext } from "@/lib/auth/request-context";
import { sharedRateLimiter } from "@/lib/auth/rate-limit";
import { isProductionCookieSecure, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { isRecordsOffline } from "@/lib/db/offline";
import { prisma } from "@/lib/db/prisma";

const loginLimiter = sharedRateLimiter("login", { limit: 10, windowMs: 15 * 60 * 1000 });

function errorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "unknown";
  const name = error instanceof Error ? error.name : "Error";
  const code = "code" in error && error.code ? String(error.code) : "";
  return code ? `${name}:${code}` : name;
}

export type LoginFormState = {
  identifierError?: string;
  passwordError?: string;
  formMessage?: string;
};

export async function login(_previous: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const identifier = String(formData.get("identifier") ?? formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next: LoginFormState = {};

  const identifierProblem = loginIdentifierError(identifier);
  if (identifierProblem) {
    next.identifierError = identifierProblem;
  }
  if (!password) {
    next.passwordError = "Enter your password.";
  } else if (password.length > 128) {
    next.passwordError = "Use a password of 128 characters or fewer.";
  }
  if (next.identifierError || next.passwordError) {
    return next;
  }

  const context = await requestContext();
  const rate = loginLimiter.check(`login:${context.ipHash}`);
  if (!rate.allowed) {
    return { formMessage: "Too many sign-in attempts. Wait before trying again." };
  }

  const signIn = () =>
    authenticatePatient(prisma, {
      identifier,
      password,
      now: new Date(),
      userAgent: context.userAgent,
      ipAddressHash: context.ipHash,
    });

  let result: Awaited<ReturnType<typeof authenticatePatient>>;
  const started = Date.now();
  try {
    result = await signIn();
  } catch (error) {
    const databaseDown = isRecordsOffline(error);
    const retry = databaseDown && Date.now() - started < 5000;
    if (retry) {
      try {
        await prisma.$disconnect();
        result = await signIn();
      } catch (retryError) {
        console.error(`login_unavailable ${errorCode(retryError)}`);
        return { formMessage: "We could not reach the care database. Wait a moment, then try again." };
      }
    } else if (databaseDown) {
      console.error(`login_unavailable ${errorCode(error)}`);
      return { formMessage: "We could not reach the care database. Wait a moment, then try again." };
    } else {
      console.error(`login_failed ${errorCode(error)}`);
      return { formMessage: "We could not sign you in. Try again." };
    }
  }

  if (!result.ok) {
    return { formMessage: result.formMessage };
  }

  const cookieStore = await cookies();
  const remember = formData.get("remember") === "on";
  const options = sessionCookieOptions(isProductionCookieSecure());
  if (remember) {
    cookieStore.set(SESSION_COOKIE, result.sessionToken, options);
  } else {
    cookieStore.set(SESSION_COOKIE, result.sessionToken, {
      httpOnly: options.httpOnly,
      sameSite: options.sameSite,
      secure: options.secure,
      path: options.path,
    });
  }
  redirect(result.destination);
}
