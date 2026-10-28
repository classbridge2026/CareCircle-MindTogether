import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionUser } from "@/lib/auth/current-user";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { accessStatus, issueConsultationToken } from "@/lib/consultations/access";
import { parseTokenRequest, requestOriginAllowed } from "@/lib/consultations/eligibility";
import { connectionFailureMessage, joinDenialMessage, liveKitUnavailableMessage } from "@/lib/consultations/messages";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  if (!requestOriginAllowed(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "This request was not accepted." }, { status: 403, headers: noStore });
  }
  const cookieStore = await cookies();
  const user = await readSessionUser(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
  if (!user) {
    return NextResponse.json({ error: "Sign in to join this consultation." }, { status: 401, headers: noStore });
  }
  let body: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json({ error: "This request was not accepted." }, { status: 400, headers: noStore });
    }
  }
  const parsed = parseTokenRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "This request was not accepted." }, { status: 400, headers: noStore });
  }
  const { appointmentId } = await context.params;
  const result = await issueConsultationToken(prisma, {
    actorUserId: user.id,
    actorStatus: user.status,
    roleCodes: user.roleCodes,
    appointmentId,
    audioOnly: parsed.audioOnly,
  });
  if (!result.ok) {
    const headers = result.code === "RATE_LIMITED" ? { ...noStore, "Retry-After": "60" } : noStore;
    const error = result.code === "NOT_CONFIGURED" || result.code === "INVALID"
      ? liveKitUnavailableMessage()
      : result.code === "UNAVAILABLE"
        ? connectionFailureMessage()
        : result.code === "RATE_LIMITED"
          ? "Please wait a moment and try again."
          : joinDenialMessage(result.code);
    return NextResponse.json({ error }, { status: accessStatus(result.code), headers });
  }
  return NextResponse.json({ serverUrl: result.serverUrl, token: result.token }, { status: 200, headers: noStore });
}
