import type { Metadata } from "next";
import Link from "next/link";
import { EmptyCatalog, PageHeader } from "@/components/admin/catalog-ui";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { formatPlatformWhen } from "@/lib/admin/labels";
import { isRecordsOffline } from "@/lib/db/offline";
import { prisma } from "@/lib/db/prisma";
import { supportCategoryLabel } from "@/lib/support/request";

export const metadata: Metadata = { title: "Account support" };
export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  try {
    const rows = await prisma.supportRequest.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
      select: { id: true, email: true, category: true, description: true, status: true, createdAt: true, attachmentMime: true },
    });
    return (
      <main className="grid gap-4">
        <PageHeader eyebrow="Operations" title="Account support" description="Requests sent from the public account support form. The newest open request is listed first." />
        {rows.length === 0 ? <EmptyCatalog>No account support requests have been sent.</EmptyCatalog> : null}
        {rows.length > 0 ? (
          <section className="admin-panel">
            <header className="admin-panel-head">
              <h2>Requests</h2>
            </header>
            <ul className="admin-feed">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link href={`/admin/support/${row.id}`} className="admin-feed-link">
                    <span>
                      <span className="admin-feed-title">{row.email}</span>
                      <span className="admin-feed-meta">
                        {supportCategoryLabel(row.category)} · {formatPlatformWhen(row.createdAt)}
                        {row.attachmentMime ? " · Screenshot" : ""}
                      </span>
                    </span>
                    <span className={row.status === "OPEN" ? "inline-flex h-7 shrink-0 items-center rounded-full bg-[#e7f3f1] px-3 text-xs font-bold text-[#0b5f59]" : "inline-flex h-7 shrink-0 items-center rounded-full bg-[#f4f7fb] px-3 text-xs font-bold text-brand-muted"}>
                      {row.status === "OPEN" ? "Open" : "Reviewed"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    );
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "P2021" || code === "P2022") return <RecordsUnavailable code="SCHEMA" />;
    if (isRecordsOffline(error)) return <RecordsUnavailable code="UNAVAILABLE" />;
    throw error;
  }
}
