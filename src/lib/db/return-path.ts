export const RETURN_PATH_HEADER = "x-carecircle-path";

/** A same-site path. Rejects other sites, the offline page, and a blank value. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) return null;
  if (raw.length > 500) return null;
  try {
    const url = new URL(raw, "http://carecircle.local");
    if (url.origin !== "http://carecircle.local") return null;
    if (url.pathname === "/offline" || url.pathname.startsWith("/offline/")) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
