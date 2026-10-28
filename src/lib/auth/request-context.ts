import { headers } from "next/headers";
import { hashIpAddress } from "./tokens";

export async function requestContext(): Promise<{
  ipHash: string;
  userAgent: string | null;
  origin: string | null;
}> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headerList.get("x-real-ip")?.trim() || "unknown";
  const userAgent = headerList.get("user-agent");
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return {
    ipHash: hashIpAddress(ip),
    userAgent,
    origin: host ? `${proto}://${host}` : null,
  };
}
