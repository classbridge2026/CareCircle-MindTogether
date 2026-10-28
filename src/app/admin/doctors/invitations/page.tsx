import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { RecordTable, TableCell } from "@/components/admin/portal-ui";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { StatusBadge, deliveryBadge, invitationBadge } from "@/components/status-badge";
import { prisma } from "@/lib/db/prisma";
import { formatWhen } from "@/lib/doctors/invitation-email";
import { loadInvitations } from "@/lib/doctors/queries";
import { InvitationControls } from "./invitation-controls";

export const metadata: Metadata = { title: "Invitations" };
export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const result = await loadInvitations(prisma);
  const now = new Date();
  if (!result.ok) {
    return <RecordsUnavailable code={result.code} />;
  }
  return (
    <section>
      <h1 className="text-3xl font-semibold tracking-tight text-brand-navy">Invitation management</h1>
      <p className="mt-2 max-w-2xl text-base leading-7 text-brand-muted">
        Each link expires, works once, and is invalidated when you resend or revoke it. A failed delivery stays visible here so it can be sent again.
      </p>
      <div className="mt-6">
        <RecordTable
          title="Invitations"
          caption="Doctor invitations"
          wide
          empty={result.rows.length === 0 ? "No invitations yet." : undefined}
          columns={
            <colgroup>
              <col className="invite-col-doctor" />
              <col className="invite-col-email" />
              <col className="invite-col-status" />
              <col className="invite-col-delivery" />
              <col className="invite-col-expires" />
              <col className="invite-col-actions" />
            </colgroup>
          }
          head={
            <>
              <th>Doctor</th>
              <th>Email</th>
              <th>Invitation</th>
              <th>Delivery</th>
              <th>Expires</th>
              <th>Actions</th>
            </>
          }
          rows={result.rows.map((row) => {
            const invitation = invitationBadge(row.status, row.expiresAt, now);
            const delivery = deliveryBadge(row.deliveryStatus);
            const outstanding = row.status === "PENDING";
            return (
              <tr key={row.id}>
                <TableCell label="Doctor">
                  <Link href={`/admin/doctors/${row.doctor.id}`} className="users-email">
                    {row.doctor.fullName}
                  </Link>
                </TableCell>
                <TableCell label="Email">{row.emailNormalized}</TableCell>
                <TableCell label="Invitation">
                  <StatusBadge tone={invitation.tone}>{invitation.label}</StatusBadge>
                </TableCell>
                <TableCell label="Delivery">
                  <StatusBadge tone={delivery.tone}>{delivery.label}</StatusBadge>
                </TableCell>
                <TableCell label="Expires">{formatWhen(row.expiresAt)}</TableCell>
                <TableCell label="Actions">
                  <InvitationControls invitationId={row.id} pending={outstanding} />
                </TableCell>
              </tr>
            );
          })}
        />
      </div>
    </section>
  );
}
