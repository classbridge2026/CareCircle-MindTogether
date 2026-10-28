import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionUser } from "@/lib/auth/current-user";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { accessStatus } from "@/lib/consultations/access";
import { requestOriginAllowed } from "@/lib/consultations/eligibility";
import { clearNotedPatientWaiting, notePatientWaiting, readPatientWaiting } from "@/lib/consultations/waiting";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

async function actor() {
  const cookieStore = await cookies();
  return readSessionUser(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
}

export async function GET(_request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers: noStore });
  const { appointmentId } = await context.params;
  const result = await readPatientWaiting(prisma, {
    actorUserId: user.id,
    actorStatus: user.status,
    roleCodes: user.roleCodes,
    appointmentId,
  });
  if (!result.ok) {
    const error = result.code === "RATE_LIMITED" ? "Please wait a moment and try again." : "That consultation could not be found.";
    return NextResponse.json({ error }, { status: accessStatus(result.code), headers: noStore });
  }
  return NextResponse.json(result.waiting ? { waiting: true, patientName: result.patientName } : { waiting: false }, { status: 200, headers: noStore });
}

export async function POST(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  if (!requestOriginAllowed(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "This request was not accepted." }, { status: 403, headers: noStore });
  }
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers: noStore });
  const { appointmentId } = await context.params;
  const result = await notePatientWaiting(prisma, {
    actorUserId: user.id,
    actorStatus: user.status,
    roleCodes: user.roleCodes,
    appointmentId,
  });
  if (!result.ok) {
    const error = result.code === "RATE_LIMITED" ? "Please wait a moment and try again." : "That consultation could not be found.";
    return NextResponse.json({ error }, { status: accessStatus(result.code), headers: noStore });
  }
  return NextResponse.json({ ok: true }, { status: 200, headers: noStore });
}

export async function DELETE(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  if (!requestOriginAllowed(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "This request was not accepted." }, { status: 403, headers: noStore });
  }
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers: noStore });
  const { appointmentId } = await context.params;
  const result = await clearNotedPatientWaiting(prisma, { actorUserId: user.id, appointmentId });
  if (!result.ok) {
    const error = result.code === "RATE_LIMITED" ? "Please wait a moment and try again." : "That consultation could not be found.";
    return NextResponse.json({ error }, { status: accessStatus(result.code), headers: noStore });
  }
  return NextResponse.json({ ok: true }, { status: 200, headers: noStore });
}
