import type { Metadata } from "next";
import Link from "next/link";
import { CatalogPager, catalogQuery } from "@/components/admin/catalog-ui";
import { Notice, RecordTable, TableCell } from "@/components/admin/portal-ui";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { StatusBadge } from "@/components/status-badge";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadAdministrators } from "@/lib/admin/directories";
import { accessLabel, userStatusLabel, userStatusTone } from "@/lib/admin/labels";
import { readPage } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";
import { GrantRoleForm } from "./grant-form";

export const metadata: Metadata = { title: "Administrators and roles" };
export const dynamic = "force-dynamic";

export default async function RolesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const page = readPage(params.page);
  const result = await loadAdministrators(prisma, page);
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  const superAdmin = actor.roleCodes.includes(SUPER_ADMIN_ROLE_CODE);
  return (
    <main className="grid gap-6">
      {!superAdmin ? <Notice>You can review administrator accounts. Only a super administrator can grant or remove those roles.</Notice> : null}
      <RecordTable
        title="Administrators"
        caption="Administrators"
        action={superAdmin ? <GrantRoleForm /> : undefined}
        empty={result.users.length === 0 ? "No administrator accounts are stored." : undefined}
        columns={
          <colgroup>
            <col className="role-col-account" />
            <col className="role-col-access" />
            <col className="role-col-status" />
          </colgroup>
        }
        head={
          <>
            <th>Account</th>
            <th>Access</th>
            <th>Status</th>
          </>
        }
        rows={result.users.map((user) => (
          <tr key={user.id}>
            <TableCell label="Account">
              <Link className="users-email" href={`/admin/users/${user.id}`}>
                {user.email}
              </Link>
            </TableCell>
            <TableCell label="Access">{accessLabel(user.roleCodes)}</TableCell>
            <TableCell label="Status">
              <StatusBadge tone={userStatusTone(user.status)}>{userStatusLabel(user.status)}</StatusBadge>
            </TableCell>
          </tr>
        ))}
      />
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={catalogQuery("/admin/roles", {})} label="administrator" />
    </main>
  );
}
