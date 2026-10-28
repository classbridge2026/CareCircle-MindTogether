/** Absolute origin for Open Graph and Twitter image URLs. */
export function metadataBase(): URL | undefined {
  const raw = process.env.APP_BASE_URL?.trim();
  if (raw) {
    try {
      const url = new URL(raw);
      if (url.protocol === "http:" || url.protocol === "https:") return url;
    } catch {
      return undefined;
    }
    return undefined;
  }
  if (process.env.NODE_ENV !== "production") {
    return new URL("http://localhost:3000");
  }
  return undefined;
}
