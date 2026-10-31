import { NextResponse } from "next/server";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { parseUuid } from "@/lib/catalog/rules";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const missing = new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const { id: rawId } = await context.params;
  const id = parseUuid(rawId);
  if (!id) return missing;
  const row = await prisma.supportRequest.findUnique({
    where: { id },
    select: { attachmentBytes: true, attachmentMime: true, attachmentName: true },
  });
  if (!row?.attachmentBytes || !row.attachmentMime) return missing;
  const name = row.attachmentName || "screenshot";
  return new NextResponse(Buffer.from(row.attachmentBytes), {
    headers: {
      "Content-Type": row.attachmentMime,
      "Content-Disposition": `inline; filename="${name.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
