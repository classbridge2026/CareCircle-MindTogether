import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readApiSession } from "@/lib/auth/current-user";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { accessStatus } from "@/lib/consultations/access";
import { listDoctorWaiting } from "@/lib/consultations/waiting";
import { isRecordsOffline } from "@/lib/db/offline";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const cookieStore = await cookies();
  const session = await readApiSession(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
  if (session.offline) return NextResponse.json({ waiting: [] }, { status: 200, headers: noStore });
  if (!session.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers: noStore });
  try {
    const result = await listDoctorWaiting(prisma, {
      actorUserId: session.user.id,
      actorStatus: session.user.status,
      roleCodes: session.user.roleCodes,
    });
    if (!result.ok) {
      const error = result.code === "RATE_LIMITED" ? "Please wait a moment and try again." : "That consultation could not be found.";
      return NextResponse.json({ error }, { status: accessStatus(result.code), headers: noStore });
    }
    return NextResponse.json({ waiting: result.waiting }, { status: 200, headers: noStore });
  } catch (error) {
    if (isRecordsOffline(error)) return NextResponse.json({ waiting: [] }, { status: 200, headers: noStore });
    throw error;
  }
}
