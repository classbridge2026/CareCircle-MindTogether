import type { Metadata } from "next";
import Link from "next/link";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { StatusBadge } from "@/components/status-badge";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { listReleasedSummaries } from "@/lib/patient/portal";

export const metadata: Metadata = { title: "Clinical summaries" };
export const dynamic = "force-dynamic";

export default async function SummariesPage() {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const summaries = await listReleasedSummaries(prisma, user.id);
  if (!summaries.ok) return <RecordsUnavailable code={summaries.code} />;

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-2xl font-semibold text-[#0C2B45]">Clinical Summaries</h1>
      </header>
      <p className="text-sm font-semibold text-[#0F766E]">Released</p>
      {summaries.summaries.length === 0 ? (
        <p className="rounded-2xl border border-[#d7e3ee] bg-white p-5 text-sm text-[#5b6b7c]">No clinical summary has been released to you.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#d7e3ee] bg-white">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs tracking-wide text-[#5b6b7c] uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Doctor</th>
                <th className="px-4 py-3 font-medium">Summary</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {summaries.summaries.map((summary) => (
                <tr key={summary.id} className="border-t border-[#e6eef5]">
                  <td className="px-4 py-3">{summary.subject}</td>
                  <td className="px-4 py-3">{summary.releasedWhen}</td>
                  <td className="px-4 py-3">{summary.doctor}<div className="text-xs text-[#5b6b7c]">{summary.specialty}</div></td>
                  <td className="px-4 py-3">{summary.service}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone="teal">Released</StatusBadge>
                    <Link className="ml-3 font-semibold text-[#0F766E]" href={`/patient/summaries/${summary.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
