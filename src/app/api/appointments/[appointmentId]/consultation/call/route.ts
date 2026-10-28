import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionUser } from "@/lib/auth/current-user";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { accessStatus } from "@/lib/consultations/access";
import { declinePatientCall, readCallNotice } from "@/lib/consultations/calling";
import { requestOriginAllowed } from "@/lib/consultations/eligibility";
import { readAppointmentCall } from "@/lib/consultations/incoming";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  const cookieStore = await cookies();
  const user = await readSessionUser(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers: noStore });
  const { appointmentId } = await context.params;
  const result = await readAppointmentCall(prisma, {
    actorUserId: user.id,
    actorStatus: user.status,
    roleCodes: user.roleCodes,
    appointmentId,
  });
  if (!result.ok) {
    const error = result.code === "RATE_LIMITED" ? "Please wait a moment and try again." : "That consultation could not be found.";
    return NextResponse.json({ error }, { status: accessStatus(result.code), headers: noStore });
  }
  if (!result.call) {
    const notice = readCallNotice(appointmentId);
    return NextResponse.json({ calling: false, ended: notice?.kind === "ended" }, { status: 200, headers: noStore });
  }
  return NextResponse.json({ calling: true, ended: false, ...result.call }, { status: 200, headers: noStore });
}

export async function POST(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  if (!requestOriginAllowed(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "This request was not accepted." }, { status: 403, headers: noStore });
  }
  const cookieStore = await cookies();
  const user = await readSessionUser(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers: noStore });
  const body = (await request.json().catch(() => null)) as { action?: string; callId?: string } | null;
  if (body?.action !== "decline" || typeof body.callId !== "string") {
    return NextResponse.json({ error: "That consultation could not be found." }, { status: 400, headers: noStore });
  }
  const { appointmentId } = await context.params;
  const result = await declinePatientCall(prisma, { actorUserId: user.id, appointmentId, callId: body.callId });
  if (!result.ok) {
    const error = result.code === "RATE_LIMITED" ? "Please wait a moment and try again." : "That consultation could not be found.";
    return NextResponse.json({ error }, { status: accessStatus(result.code), headers: noStore });
  }
  return NextResponse.json({ ok: true, declined: result.declined }, { status: 200, headers: noStore });
}
