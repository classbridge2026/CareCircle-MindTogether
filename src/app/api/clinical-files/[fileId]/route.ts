import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionUser } from "@/lib/auth/current-user";
import { sharedRateLimiter } from "@/lib/auth/rate-limit";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { openClinicalFile } from "@/lib/clinical/records";
import { safeRequestId } from "@/lib/clinical/rules";
import { prisma } from "@/lib/db/prisma";
import { createPrivateStorage } from "@/lib/storage/private-storage";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  const cookieStore = await cookies();
  const user = await readSessionUser(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
  const limit = sharedRateLimiter("clinical-file", { limit: 40, windowMs: 60_000 }).check(user?.id ?? "anonymous");
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many document requests. Wait a moment and try again." }, { status: 429, headers: noStore });
  }
  const result = await openClinicalFile(fileId, user?.id ?? null, {
    db: prisma,
    storage: createPrivateStorage(),
    requestId: safeRequestId(request.headers.get("x-request-id")),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status, headers: noStore });
  }
  return new NextResponse(Buffer.from(result.body), {
    status: 200,
    headers: {
      "Content-Type": result.mimeType,
      "Content-Length": String(result.body.byteLength),
      "Content-Disposition": `attachment; filename="${result.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
