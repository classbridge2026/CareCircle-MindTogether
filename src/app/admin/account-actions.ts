"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashSessionToken } from "@/lib/auth/tokens";
import { isProductionCookieSecure, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function signOutAction() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (raw) {
    await prisma.session.updateMany({
      where: { tokenHash: hashSessionToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.set(SESSION_COOKIE, "", { ...sessionCookieOptions(isProductionCookieSecure()), maxAge: 0 });
  redirect("/login");
}
