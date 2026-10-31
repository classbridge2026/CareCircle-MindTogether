import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/catalog-ui";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { primaryButtonClass } from "@/components/form-classes";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { formatPlatformWhen } from "@/lib/admin/labels";
import { isRecordsOffline } from "@/lib/db/offline";
import { prisma } from "@/lib/db/prisma";
import { parseUuid } from "@/lib/catalog/rules";
import { supportCategoryLabel } from "@/lib/support/request";
import { reviewSupportRequestAction } from "../actions";

export const metadata: Metadata = { title: "Account support request" };
export const dynamic = "force-dynamic";

export default async function AdminSupportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const { id: rawId } = await params;
  const id = parseUuid(rawId);
  if (!id) notFound();
  try {
    const row = await prisma.supportRequest.findUnique({
      where: { id },
      select: { id: true, email: true, category: true, description: true, status: true, createdAt: true, reviewedAt: true, attachmentMime: true, attachmentName: true },
    });
    if (!row) notFound();
    return (
      <main className="grid gap-4">
        <PageHeader eyebrow="Account support" title={row.email} description={`${supportCategoryLabel(row.category)} · ${formatPlatformWhen(row.createdAt)}`} />
        <section className="admin-panel">
          <header className="admin-panel-head">
            <h2>{row.status === "OPEN" ? "Open" : "Reviewed"}</h2>
            <Link className="text-sm font-semibold text-brand-teal" href="/admin/support">
              All requests
            </Link>
          </header>
          <div className="admin-panel-body grid gap-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-brand-ink">{row.description}</p>
            {row.attachmentMime ? (
              <figure className="grid gap-2">
                <figcaption className="text-sm font-semibold text-brand-navy">{row.attachmentName || "Screenshot"}</figcaption>
                <img src={`/admin/support/${row.id}/file`} alt="Screenshot sent with the request" className="max-h-96 max-w-full rounded-xl border border-brand-line bg-brand-paper object-contain" />
              </figure>
            ) : (
              <p className="text-sm text-brand-muted">No screenshot was attached.</p>
            )}
            {row.reviewedAt ? <p className="text-sm text-brand-muted">Reviewed {formatPlatformWhen(row.reviewedAt)}</p> : null}
            {row.status === "OPEN" ? (
              <form action={reviewSupportRequestAction}>
                <input type="hidden" name="id" value={row.id} />
                <button className={primaryButtonClass} type="submit">
                  Mark reviewed
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </main>
    );
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "P2021" || code === "P2022") return <RecordsUnavailable code="SCHEMA" />;
    if (isRecordsOffline(error)) return <RecordsUnavailable code="UNAVAILABLE" />;
    throw error;
  }
}
