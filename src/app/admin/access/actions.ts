"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import type { AdminActionState } from "@/lib/admin/action-state";
import { changeElevatedRole, changeUserAccountStatus, grantElevatedRoleByEmail } from "@/lib/admin/mutations";
import { prisma } from "@/lib/db/prisma";

function state(result: { ok: boolean; message: string }): AdminActionState {
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function updateAccountStatusAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const change = formData.get("change") === "reactivate" ? "reactivate" : "suspend";
  const result = await changeUserAccountStatus(
    { userId: String(formData.get("userId") ?? ""), change, reason: String(formData.get("reason") ?? "") },
    { db: prisma, actor: { userId: user.id, roleCodes: user.roleCodes } },
  );
  revalidatePath("/admin/users");
  revalidatePath("/admin/roles");
  return state(result);
}

export async function updateRoleAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await requireStoredRoles([SUPER_ADMIN_ROLE_CODE]);
  const raw = String(formData.get("roleChange") ?? "");
  const [changeName, roleCode] = raw.split(":");
  const change = changeName === "revoke" ? "revoke" : "grant";
  const result = await changeElevatedRole(
    { userId: String(formData.get("userId") ?? ""), roleCode: roleCode ?? "", change },
    { db: prisma, actor: { userId: user.id, roleCodes: user.roleCodes } },
  );
  revalidatePath("/admin/users");
  revalidatePath("/admin/roles");
  return state(result);
}

export async function grantRoleByEmailAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await requireStoredRoles([SUPER_ADMIN_ROLE_CODE]);
  const result = await grantElevatedRoleByEmail(
    { email: String(formData.get("email") ?? ""), roleCode: String(formData.get("roleCode") ?? "") },
    { db: prisma, actor: { userId: user.id, roleCodes: user.roleCodes } },
  );
  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
  return state(result);
}
