export const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
] as const;

export const portalNoStoreHeaders = [{ key: "Cache-Control", value: "private, no-store" }] as const;
