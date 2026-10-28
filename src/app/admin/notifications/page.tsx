import type { Metadata } from "next";
import Link from "next/link";
import { CatalogPager, EmptyCatalog, PageHeader, catalogQuery } from "@/components/admin/catalog-ui";
import { RecordTable, TableCell } from "@/components/admin/portal-ui";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { StatusBadge } from "@/components/status-badge";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadNotifications } from "@/lib/admin/directories";
import { emailProviderConfigured } from "@/lib/auth/delivery";
import { listDeliveryLog } from "@/lib/notifications/admin-log";
import { retryDeliveryAction } from "./actions";
import { formatPlatformWhen } from "@/lib/admin/labels";
import { readPage } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";
import { MarkViewedNotifications } from "@/components/notifications/mark-viewed";
import { ClearNotificationsForm, MarkAllReadForm, MarkReadForm } from "./notification-forms";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const page = readPage(params.page);
  const deliveryPage = readPage(typeof params.deliveryPage === "string" ? params.deliveryPage : undefined);
  const [result, deliveries] = await Promise.all([
    loadNotifications(prisma, user.id, page),
    listDeliveryLog(prisma, {
      page: deliveryPage,
      channel: typeof params.channel === "string" ? params.channel : undefined,
      status: typeof params.status === "string" ? params.status : undefined,
      type: typeof params.type === "string" ? params.type : undefined,
    }),
  ]);
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  return (
    <main className="grid gap-6">
      <MarkViewedNotifications ids={result.notifications.filter((note) => !note.readAt).map((note) => note.id)} />
      <PageHeader eyebrow="Platform" title="Notifications" description="Your own notifications are listed first. The delivery log shows channel status for the clinic. Previews do not include clinical note text." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-muted">{result.unread} unread</p>
        <div className="flex flex-wrap gap-2">
          {result.unread > 0 ? <MarkAllReadForm /> : null}
          {result.total > 0 ? <ClearNotificationsForm /> : null}
        </div>
      </div>
      {result.notifications.length === 0 ? (
        <EmptyCatalog>You have no notifications.</EmptyCatalog>
      ) : (
        <ul className="grid gap-3">
          {result.notifications.map((note) => (
            <li key={note.id} className="rounded-2xl border border-brand-line bg-white px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-brand-navy">{note.title}</p>
                  {note.preview ? <p className="mt-1 text-sm leading-6 text-brand-muted">{note.preview}</p> : null}
                  <p className="mt-2 text-xs text-brand-muted">
                    {note.channel} · {note.type} · {formatPlatformWhen(new Date(note.createdAt))}
                  </p>
                  {note.entityType === "DoctorProfile" && note.entityId ? (
                    <Link className="mt-2 inline-flex text-sm font-semibold text-brand-teal" href={`/admin/doctors/${note.entityId}`}>
                      Review and verify
                    </Link>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge tone={note.readAt ? "slate" : note.status === "FAILED" ? "red" : "teal"}>{note.readAt ? "Read" : note.status === "FAILED" ? "Failed" : "Unread"}</StatusBadge>
                  {note.readAt ? null : <MarkReadForm notificationId={note.id} />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={catalogQuery("/admin/notifications", {})} label="notification" />
      <section className="grid gap-3">
        <p className="text-sm leading-6 text-brand-muted">
          In-app storage is always available. Email is {emailProviderConfigured() ? "configured" : "not configured"}. A sent email status means Gmail accepted the message, not that the mailbox confirmed it. Text messages are not sent.
        </p>
        {deliveries.unavailable ? <p className="users-empty">Per-channel attempt history needs the notification migration. It has not been applied.</p> : null}
        {deliveries.ok && !deliveries.unavailable ? (
          <RecordTable
            title="Delivery log"
            caption="Notification deliveries"
            wide
            empty={deliveries.rows.length === 0 ? "No deliveries match this view." : undefined}
            columns={
              <colgroup>
                <col className="delivery-col-when" />
                <col className="delivery-col-recipient" />
                <col className="delivery-col-type" />
                <col className="delivery-col-channel" />
                <col className="delivery-col-status" />
                <col className="delivery-col-attempts" />
                <col className="delivery-col-error" />
                <col className="delivery-col-action" />
              </colgroup>
            }
            head={
              <>
                <th>When</th>
                <th>Recipient</th>
                <th>Type</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Error</th>
                <th>Actions</th>
              </>
            }
            rows={deliveries.rows.map((row) => (
              <tr key={row.id}>
                <TableCell label="When">{formatPlatformWhen(new Date(row.createdAt))}</TableCell>
                <TableCell label="Recipient">{row.recipient}</TableCell>
                <TableCell label="Type">{row.type}</TableCell>
                <TableCell label="Channel">{row.channel}</TableCell>
                <TableCell label="Status">{row.status}</TableCell>
                <TableCell label="Attempts">{row.attemptCount}</TableCell>
                <TableCell label="Error">{row.errorCode ?? "None"}</TableCell>
                <TableCell label="Actions">
                  {row.retryable ? (
                    <form action={retryDeliveryAction}>
                      <input type="hidden" name="notificationId" value={row.id} />
                      <button className="users-email" type="submit">Retry</button>
                    </form>
                  ) : (
                    <span className="users-sub">No action</span>
                  )}
                </TableCell>
              </tr>
            ))}
          />
        ) : null}
      </section>
    </main>
  );
}
