import type { Metadata } from "next";
import Link from "next/link";
import { CatalogPager, PageHeader, catalogQuery } from "@/components/admin/catalog-ui";
import { RecordTable, TableCell } from "@/components/admin/portal-ui";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadAuditLogs } from "@/lib/admin/directories";
import { adminEntityHref, formatPlatformWhen, metadataPreview } from "@/lib/admin/labels";
import { readPage, readParam } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Audit logs" };
export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const q = readParam(params.q);
  const from = readParam(params.from);
  const to = readParam(params.to);
  const page = readPage(params.page);
  const result = await loadAuditLogs(prisma, { q, from, to, page });
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  return (
    <main className="grid gap-6">
      <PageHeader eyebrow="Platform" title="Audit logs" description="Administrative and clinical access events. Note text, passwords, tokens, and file bytes are omitted. These rows cannot be edited or deleted in the application. The database also rejects updates and deletes on audit logs, access logs, note versions, and summary release history." />
      <LiveQueryForm
        pathname="/admin/audit"
        className="grid gap-3 rounded-2xl border border-brand-line bg-white p-4 md:grid-cols-[minmax(0,1fr)_11rem_11rem] md:items-end"
        fields={[
          { name: "q", label: "Search", kind: "text", value: q, placeholder: "Action, record, or actor", labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1` },
          { name: "from", label: "From", kind: "date", value: from, labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1` },
          { name: "to", label: "To", kind: "date", value: to, labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1` },
        ]}
      />
      <RecordTable
        title="Events"
        caption="Audit events"
        wide
        empty={result.audits.length === 0 ? "No audit events match these filters." : undefined}
        columns={
          <colgroup>
            <col className="audit-col-when" />
            <col className="audit-col-actor" />
            <col className="audit-col-action" />
            <col className="audit-col-record" />
            <col className="audit-col-meta" />
          </colgroup>
        }
        head={
          <>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Record</th>
            <th>Metadata</th>
          </>
        }
        rows={result.audits.map((audit) => {
          const href = adminEntityHref(audit.entityType, audit.entityId);
          return (
            <tr key={audit.id}>
              <TableCell label="When">{formatPlatformWhen(new Date(audit.occurredAt))}</TableCell>
              <TableCell label="Actor">{audit.actor}</TableCell>
              <TableCell label="Action">{audit.action}</TableCell>
              <TableCell label="Record">
                {href ? (
                  <Link className="users-email" href={href}>
                    {audit.entityType}
                  </Link>
                ) : (
                  audit.entityType
                )}
                <span className="users-sub">{audit.entityId}</span>
              </TableCell>
              <TableCell label="Metadata">{metadataPreview(audit.metadata)}</TableCell>
            </tr>
          );
        })}
      />
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={catalogQuery("/admin/audit", { q, from, to })} label="event" />
    </main>
  );
}
