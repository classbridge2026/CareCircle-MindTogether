import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readApiSession } from "@/lib/auth/current-user";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { isRecordsOffline } from "@/lib/db/offline";
import { prisma } from "@/lib/db/prisma";
import { openProfileImage } from "@/lib/profile/image";

export const dynamic = "force-dynamic";

const missing = new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_request: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId } = await context.params;
  try {
    const cookieStore = await cookies();
    const session = await readApiSession(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
    if (session.offline) return missing;
    const result = await openProfileImage(
      userId,
      session.user ? { id: session.user.id, roleCodes: session.user.roleCodes } : null,
      { db: prisma },
    );
    if (!result.ok) return missing;
    return new NextResponse(Buffer.from(result.body), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Length": String(result.body.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isRecordsOffline(error)) return missing;
    throw error;
  }
}
