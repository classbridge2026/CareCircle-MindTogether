import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "./constants";

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function isProductionCookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
}

export { SESSION_COOKIE };
