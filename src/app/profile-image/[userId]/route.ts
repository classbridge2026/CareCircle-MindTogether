import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readApiSession } from "@/lib/auth/current-user";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { isRecordsOffline } from "@/lib/db/offline";
import { prisma } from "@/lib/db/prisma";
import { openProfileImage } from "@/lib/profile/image";

export const dynamic = "force-dynamic";

const missing = new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

const remembered = new Map<string, { until: number; body: Uint8Array; mimeType: string; shared: boolean }>();

function rememberedImage(key: string) {
  const hit = remembered.get(key);
  if (!hit) return null;
  if (hit.until <= Date.now()) {
    remembered.delete(key);
    return null;
  }
  return hit;
}

export async function GET(_request: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId } = await context.params;
  try {
    const cookieStore = await cookies();
    const session = await readApiSession(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
    if (session.offline) return missing;
    const viewer = session.user ? { id: session.user.id, roleCodes: session.user.roleCodes } : null;
    const cacheKey = `${viewer?.id ?? "public"}:${userId}`;
    const stored = rememberedImage(cacheKey);
    const result = stored
      ? { ok: true as const, body: stored.body, mimeType: stored.mimeType, shared: stored.shared }
      : await openProfileImage(userId, viewer, { db: prisma });
    if (!result.ok) return missing;
    if (!stored) {
      if (remembered.size > 40) remembered.clear();
      remembered.set(cacheKey, { until: Date.now() + 5 * 60 * 1000, body: result.body, mimeType: result.mimeType, shared: result.shared });
    }
    return new NextResponse(Buffer.from(result.body), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Length": String(result.body.byteLength),
        // The photo address includes the save time, so the browser can keep this copy.
        "Cache-Control": result.shared ? "public, max-age=86400, immutable" : "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isRecordsOffline(error)) return missing;
    throw error;
  }
}
