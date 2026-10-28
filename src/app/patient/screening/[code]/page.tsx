import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { SCREENING_CONSENT_VERSION, RESULT_DISCLAIMER } from "@/lib/screening/rules";
import { readScreeningTool } from "@/lib/screening/service";
import { startScreeningAction } from "../actions";
import "../screening.css";

export const metadata: Metadata = { title: "Screening" };
export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  CONSENT: "Confirm the screening notice before starting.",
  FORBIDDEN: "This instrument is not available.",
  RATE: "Too many screening attempts were made. Wait and try again.",
  NOT_FOUND: "This screening could not be started.",
  UNAVAILABLE: "The screening service is unavailable.",
  SCHEMA: "The screening registry is not available yet.",
};

export default async function ScreeningToolPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireStoredRoles([PATIENT_ROLE_CODE]);
  const { code } = await params;
  const query = await searchParams;
  const tool = await readScreeningTool(prisma, code);
  if (!tool.ok) {
    if (tool.code === "NOT_FOUND") notFound();
    return <RecordsUnavailable code={tool.code === "SCHEMA" ? "SCHEMA" : "UNAVAILABLE"} />;
  }
  const notice = query.notice ? notices[query.notice] : null;

  return (
    <div className="screen-centre">
      <Link className="text-sm font-semibold text-[#0F766E]" href="/patient/screening">Back to Screening Centre</Link>
      <section className="screen-panel">
        <p className="screen-progress">{tool.candidate.abbreviation}</p>
        <h1>{tool.candidate.title}</h1>
        <p>{tool.purpose}</p>
        <p>{RESULT_DISCLAIMER}</p>
        <p>Privacy: answers are stored with your clinical record. They are not placed in links, and they are not sent by email or SMS.</p>
        <p>Intended population: {tool.intendedPopulation}</p>
        <p>Instructions: {tool.instructions}</p>
        {tool.expectedMinutes ? <p>Expected time: about {tool.expectedMinutes} minutes. Language: {tool.language}.{tool.version ? ` Version ${tool.version}.` : ""}</p> : null}
        <p>Source: {tool.sourceReference}</p>
        {notice ? <p role="alert">{notice}</p> : null}
        {tool.open ? (
          <form action={startScreeningAction} className="grid gap-3">
            <input name="code" type="hidden" value={tool.candidate.code} />
            <label className="flex gap-3 text-sm leading-6 text-[#0C2B45]">
              <input name="consent" type="checkbox" value="yes" required />
              <span>I have read the purpose and limits of this screen (notice {SCREENING_CONSENT_VERSION}) and I want to continue. This is not emergency care.</span>
            </label>
            <button className="w-fit rounded-xl bg-[#0F766E] px-4 py-3 text-sm font-semibold text-white" type="submit">Continue to questions</button>
          </form>
        ) : (
          <div>
            <h2>Not available yet</h2>
            <ul className="mt-2 list-disc pl-5">
              {tool.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
            <Link className="mt-3 inline-block font-semibold text-[#0F766E]" href="/patient/find">Book an appointment</Link>
          </div>
        )}
      </section>
    </div>
  );
}
