import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { formatPlatformWhen } from "@/lib/admin/labels";
import { prisma } from "@/lib/db/prisma";
import { AUTOMATIC_BAND_LABEL } from "@/lib/screening/questions";
import { readOwnResult } from "@/lib/screening/service";
import "../../screening.css";

export const metadata: Metadata = { title: "Screening result" };
export const dynamic = "force-dynamic";

export default async function ScreeningResultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const { id } = await params;
  const result = await readOwnResult(prisma, { actorUserId: user.id, assessmentId: id });
  if (!result.ok) {
    if (result.code === "NOT_FOUND") notFound();
    return <RecordsUnavailable code={result.code === "SCHEMA" ? "SCHEMA" : "UNAVAILABLE"} />;
  }
  const { view } = result;

  return (
    <div className="screen-centre">
      <Link className="text-sm font-semibold text-[#0F766E]" href="/patient/screening/history">Back to history</Link>
      <section className="screen-panel">
        <p className="screen-progress">{result.abbreviation} · Version {result.version}</p>
        <h1>{result.name}</h1>
        <p>Completed {formatPlatformWhen(view.completedAt)} · Algorithm {view.algorithmVersion}</p>
        <p className="text-3xl font-semibold text-[#0C2B45]">{view.score}<span className="text-base font-medium text-[#5b6b7c]"> / {view.maxScore}</span></p>
        {view.band === AUTOMATIC_BAND_LABEL ? (
          <p>This number is the sum of the answers. Severity bands were not supplied for this version.</p>
        ) : (
          <p>{view.band}</p>
        )}
        <p>{view.disclaimer}</p>
        {result.safety.kind === "show" ? (
          <div>
            <h2>If you need help now</h2>
            <p>These are the verified contacts configured for {result.safety.contacts.region}. This page is not a live monitor, and it does not confirm that a clinician has been notified.</p>
            <ul className="list-disc pl-5">
              {result.safety.contacts.lines.map((line) => <li key={line.label}>{line.label}: {line.value}</li>)}
            </ul>
          </div>
        ) : null}
        {result.safety.kind === "blocked" ? (
          <p role="alert">A concerning answer was recorded, but verified local support contacts are not configured. Contact local emergency services or a clinician directly. This system has not notified a clinician.</p>
        ) : null}
        <h2>Next steps</h2>
        <p>You can book an appointment to discuss this result with a clinician.</p>
        <div className="screen-toolbar">
          <Link className="primary" href="/patient/find">Book an appointment</Link>
          <Link className="quiet" href="/patient/screening">Back to Screening Centre</Link>
        </div>
      </section>
    </div>
  );
}
