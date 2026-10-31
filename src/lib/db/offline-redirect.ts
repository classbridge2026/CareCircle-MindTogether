import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RETURN_PATH_HEADER, safeReturnPath } from "./return-path";

/** Sends the person to the offline page and remembers the page that failed. */
export async function redirectOffline(): Promise<never> {
  const headerStore = await headers();
  const current = safeReturnPath(headerStore.get(RETURN_PATH_HEADER));
  const nextUrl = safeReturnPath(headerStore.get("next-url"));
  let refererPath: string | null = null;
  const referer = headerStore.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      refererPath = safeReturnPath(`${url.pathname}${url.search}`);
    } catch {
      refererPath = null;
    }
  }
  const from = current || nextUrl || refererPath;
  redirect(from ? `/offline?from=${encodeURIComponent(from)}` : "/offline");
}
