"use server";

import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadGuideFacts } from "@/lib/admin/guide-facts";
import type { PortalFacts } from "@/lib/admin/portal-guide";
import { prisma } from "@/lib/db/prisma";

export async function loadGuideFactsAction(): Promise<PortalFacts | null> {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  return loadGuideFacts(prisma);
}
