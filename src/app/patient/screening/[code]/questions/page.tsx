import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { loadOwnSession } from "@/lib/screening/service";
import { ScreeningSessionForm } from "./session-form";
import "../../screening.css";

export const metadata: Metadata = { title: "Screening questions" };
export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  INVALID: "Those answers could not be accepted. Check each question and submit again.",
  CLOSED: "This assessment was already submitted and cannot be changed.",
  SAFETY: "This screen cannot be submitted because a verified local support pathway is not configured.",
  RATE: "Too many submissions were attempted. Wait before trying again.",
  FORBIDDEN: "This instrument is not approved for use.",
};

export default async function ScreeningQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ assessment?: string; notice?: string }>;
}) {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const { code } = await params;
  const query = await searchParams;
  if (!query.assessment) notFound();
  const session = await loadOwnSession(prisma, { actorUserId: user.id, assessmentId: query.assessment });
  if (!session.ok) {
    if (session.code === "NOT_FOUND" || session.code === "CLOSED") notFound();
    if (session.code === "SCHEMA" || session.code === "UNAVAILABLE") return <RecordsUnavailable code={session.code === "SCHEMA" ? "SCHEMA" : "UNAVAILABLE"} />;
    return (
      <section className="screen-panel">
        <p>This questionnaire is not available.</p>
        <Link className="font-semibold text-[#0F766E]" href={`/patient/screening/${code}`}>Back</Link>
      </section>
    );
  }

  return (
    <div className="screen-centre">
      <Link className="text-sm font-semibold text-[#0F766E]" href={`/patient/screening/${session.code}`}>Back</Link>
      <ScreeningSessionForm
        assessmentId={session.assessmentId}
        code={session.code}
        items={session.items}
        notice={query.notice ? notices[query.notice] ?? null : null}
        title={session.title}
      />
    </div>
  );
}
