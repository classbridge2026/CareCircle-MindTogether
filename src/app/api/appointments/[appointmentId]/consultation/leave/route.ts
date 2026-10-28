import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionUser } from "@/lib/auth/current-user";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { accessStatus, recordParticipantLeave } from "@/lib/consultations/access";
import { requestOriginAllowed } from "@/lib/consultations/eligibility";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  if (!requestOriginAllowed(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "This request was not accepted." }, { status: 403, headers: noStore });
  }
  const cookieStore = await cookies();
  const user = await readSessionUser(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers: noStore });
  const { appointmentId } = await context.params;
  const result = await recordParticipantLeave(prisma, {
    actorUserId: user.id,
    actorStatus: user.status,
    roleCodes: user.roleCodes,
    appointmentId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "The consultation could not be updated." }, { status: accessStatus(result.code), headers: noStore });
  }
  return NextResponse.json({ ok: true }, { status: 200, headers: noStore });
}
