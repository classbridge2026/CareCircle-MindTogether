import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { homeForRoles } from "./access";
import { isRecordsOffline } from "@/lib/db/offline";
import { readSessionUser } from "./current-user";
import { SESSION_COOKIE } from "./session";
import { prisma } from "@/lib/db/prisma";

const readCachedSession = cache(async (token: string) => {
  return readSessionUser(prisma, token || undefined, new Date());
});

/** Reads the session and allows only the roles stored for that account. */
export async function requireStoredRoles(allowed: string[]) {
  const cookieStore = await cookies();
  let user;
  try {
    user = await readCachedSession(cookieStore.get(SESSION_COOKIE)?.value ?? "");
  } catch (error) {
    if (isRecordsOffline(error)) redirect("/offline");
    throw error;
  }
  if (!user) {
    redirect("/login");
  }
  if (user.status === "PENDING_VERIFICATION") {
    redirect("/verify");
  }
  if (user.status !== "ACTIVE") {
    redirect("/account-unavailable");
  }
  if (!allowed.some((code) => user.roleCodes.includes(code))) {
    const home = homeForRoles(user.roleCodes);
    redirect(home ?? "/account-unavailable");
  }
  return user;
}
