import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { StatusBadge } from "@/components/status-badge";
import { prisma } from "@/lib/db/prisma";
import { credentialLabel } from "@/lib/doctors/rules";
import { formatWhen } from "@/lib/doctors/invitation-email";
import { loadCredentialForReview } from "@/lib/doctors/queries";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Credential review" };
export const dynamic = "force-dynamic";

export default async function CredentialReviewPage({
  params,
}: {
  params: Promise<{ id: string; credentialId: string }>;
}) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const { id, credentialId } = await params;
  const credential = await loadCredentialForReview(prisma, credentialId);
  if (!credential || credential.doctor.id !== id) {
    notFound();
  }
  const tone = credential.status === "VERIFIED" ? "teal" : credential.status === "REJECTED" ? "red" : "amber";
  return (
    <article className="grid max-w-3xl gap-6">
      <header>
        <p className="text-sm font-medium tracking-[0.16em] text-brand-teal uppercase">Credential review</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-navy">{credentialLabel(credential.type)}</h1>
        <p className="mt-2 text-brand-muted">{credential.doctor.fullName}</p>
        <div className="mt-3">
          <StatusBadge tone={tone}>{credential.status}</StatusBadge>
        </div>
      </header>
      <section className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5 text-sm">
        <p>File name: {credential.originalFilename ?? "Document"}</p>
        <p>Type: {credential.mimeType}</p>
        <p>Size: {Math.ceil(credential.sizeBytes / 1024)} KB</p>
        <p>Uploaded: {formatWhen(credential.createdAt)}</p>
        <p>Expires: {credential.expiresOn ? credential.expiresOn.toISOString().slice(0, 10) : "Not recorded"}</p>
        {credential.reviewNotes ? <p>Review notes: {credential.reviewNotes}</p> : null}
        {credential.archivedAt ? <p>This document was replaced and is kept for the review history.</p> : null}
        <a
          className="font-semibold text-brand-teal"
          href={`/api/credentials/${credential.id}/file`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open or download document
        </a>
      </section>
      {credential.archivedAt ? null : <ReviewForm credentialId={credential.id} doctorId={credential.doctor.id} />}
      <Link href={`/admin/doctors/${credential.doctor.id}`} className="text-sm font-semibold text-brand-teal">
        Back to doctor details
      </Link>
    </article>
  );
}
