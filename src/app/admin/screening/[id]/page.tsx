import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { textInputClass, primaryButtonClass } from "@/components/form-classes";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { formatPlatformWhen } from "@/lib/admin/labels";
import { prisma } from "@/lib/db/prisma";
import { editorStateFromStored } from "@/lib/screening/questions";
import { governanceChangeAllowed } from "@/lib/screening/rules";
import { readAdminTool } from "@/lib/screening/service";
import { updateScreeningGovernanceAction } from "../actions";
import { QuestionEditor } from "./question-editor";

export const metadata: Metadata = { title: "Screening instrument" };
export const dynamic = "force-dynamic";

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

export default async function AdminScreeningDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const { id } = await params;
  const result = await readAdminTool(prisma, id);
  if (!result.ok) {
    if (result.code === "NOT_FOUND") notFound();
    return <RecordsUnavailable code={result.code === "SCHEMA" ? "SCHEMA" : "UNAVAILABLE"} />;
  }
  const tool = result.tool;
  const canGovern = governanceChangeAllowed(user.roleCodes);
  const latest = tool.versions[0];
  const questions = editorStateFromStored(latest?.items ?? [], latest?.scoringSpec ?? null, latest?.scoringAlgorithmVersion ?? null);

  return (
    <section className="grid max-w-3xl gap-5">
      <Link className="text-sm font-semibold text-brand-teal" href="/admin/screening">Back to screening management</Link>
      <header>
        <p className="text-sm text-brand-teal">{tool.abbreviation}</p>
        <h1 className="text-2xl font-semibold text-brand-navy">{tool.name}</h1>
        <p className="mt-2 text-sm leading-6 text-brand-muted">{tool.purpose}</p>
      </header>
      <dl className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5 text-sm sm:grid-cols-2">
        <div><dt className="text-brand-muted">Category</dt><dd>{label(tool.category)}</dd></div>
        <div><dt className="text-brand-muted">Language</dt><dd>{tool.language}</dd></div>
        <div><dt className="text-brand-muted">Expected time</dt><dd>{tool.expectedMinutes} minutes</dd></div>
        <div><dt className="text-brand-muted">Intended population</dt><dd>{tool.intendedPopulation}</dd></div>
        <div className="sm:col-span-2"><dt className="text-brand-muted">Instructions</dt><dd>{tool.instructions}</dd></div>
        <div className="sm:col-span-2"><dt className="text-brand-muted">Source and licensing note</dt><dd>{tool.sourceReference}</dd></div>
        <div><dt className="text-brand-muted">Safety protocol required</dt><dd>{tool.safetyProtocolRequired ? "Yes" : "No"}</dd></div>
        <div><dt className="text-brand-muted">Safety protocol approved</dt><dd>{tool.safetyProtocolApproved ? "Yes" : "No"}</dd></div>
        <div><dt className="text-brand-muted">Support contacts configured</dt><dd>{result.contactsConfigured ? "Yes" : "No"} · <Link className="font-semibold text-brand-teal" href="/admin/screening">Set the service name and number</Link></dd></div>
        <div><dt className="text-brand-muted">Availability</dt><dd>{label(tool.availability)}</dd></div>
      </dl>
      <section className="grid gap-2 rounded-2xl border border-brand-line bg-white p-5 text-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Version history</h2>
        <ul className="grid gap-2">
          {tool.versions.map((version) => (
            <li key={version.id}>Version {version.version} · {formatPlatformWhen(version.createdAt)} · Scoring algorithm {version.scoringAlgorithmVersion ?? "not recorded"}</li>
          ))}
        </ul>
        <p>Patient responses are not shown in administration. Approval status does not change the questions.</p>
      </section>
      {canGovern ? (
        <QuestionEditor toolId={tool.id} initial={questions} />
      ) : (
        <section className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5 text-sm">
          <h2 className="text-lg font-semibold text-brand-navy">Questions</h2>
          {questions.questions.length === 0 ? <p>No questions are stored for this version.</p> : (
            <ol className="grid list-decimal gap-3 pl-5">
              {questions.questions.map((question, index) => (
                <li key={`${index}-${question.prompt}`}>
                  <p>{question.prompt}</p>
                  <p className="text-brand-muted">{question.choices.map((choice) => `${choice.value} ${choice.label}`).join(" · ")}</p>
                </li>
              ))}
            </ol>
          )}
          <p>{questions.mode === "uploaded" ? "Scoring bands are stored for this version." : questions.mode === "automatic" ? "This version uses a numeric total because no scoring bands were supplied." : "No scoring is stored."}</p>
        </section>
      )}
      {canGovern ? (
        <form action={updateScreeningGovernanceAction} className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
          <h2 className="text-lg font-semibold text-brand-navy">Clinical and licensing status</h2>
          <p className="text-sm text-brand-muted">A super administrator can record approval status. Saving this status does not change the questions above, and it does not force the instrument active.</p>
          <input name="toolId" type="hidden" value={tool.id} />
          <label className="text-sm font-medium">
            Licensing status
            <select name="licenseStatus" defaultValue={tool.licenseStatus} className={`${textInputClass} mt-1`}>
              <option value="NOT_REVIEWED">Not reviewed</option>
              <option value="RESTRICTION_UNRESOLVED">Restriction unresolved</option>
              <option value="CLEARED_FOR_CLINICAL_USE">Cleared for clinical use</option>
              <option value="PROHIBITED">Prohibited</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Clinical approval
            <select name="approvalState" defaultValue={tool.approvalState} className={`${textInputClass} mt-1`}>
              <option value="PENDING_CLINICAL_REVIEW">Pending clinical review</option>
              <option value="CLINICALLY_APPROVED">Clinically approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="RETIRED">Retired</option>
            </select>
          </label>
          <button className={primaryButtonClass} type="submit">Save status</button>
        </form>
      ) : (
        <p className="rounded-2xl border border-brand-line bg-white p-5 text-sm">Ordinary administrators can review this registry. Changing approval or licensing status requires a super administrator.</p>
      )}
    </section>
  );
}
