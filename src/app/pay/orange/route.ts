import { NextResponse } from "next/server";
import { parseUuid } from "@/lib/catalog/rules";

export function GET(request: Request) {
  const url = new URL(request.url);
  const id = parseUuid(url.searchParams.get("a") ?? "");
  const cancelled = url.searchParams.get("c") === "1";
  const target = id ? `/patient/appointments/${id}?payment=${cancelled ? "cancel" : "return"}` : "/patient/payments";
  return NextResponse.redirect(new URL(target, url.origin));
}
