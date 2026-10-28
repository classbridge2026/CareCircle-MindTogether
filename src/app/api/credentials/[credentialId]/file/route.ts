import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionUser } from "@/lib/auth/current-user";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { openCredentialFile } from "@/lib/doctors/credentials";
import { createPrivateStorage } from "@/lib/storage/private-storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ credentialId: string }> }) {
  const { credentialId } = await context.params;
  const cookieStore = await cookies();
  const user = await readSessionUser(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
  const result = await openCredentialFile(
    credentialId,
    { userId: user?.id ?? null, status: user?.status ?? null, roleCodes: user?.roleCodes ?? [] },
    { db: prisma, storage: createPrivateStorage() },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
  }
  return new NextResponse(Buffer.from(result.body), {
    status: 200,
    headers: {
      "Content-Type": result.mimeType,
      "Content-Length": String(result.body.byteLength),
      "Content-Disposition": `inline; filename="${result.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
