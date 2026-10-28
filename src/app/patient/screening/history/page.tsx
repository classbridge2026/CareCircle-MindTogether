import type { Metadata } from "next";
import Link from "next/link";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { formatPlatformWhen } from "@/lib/admin/labels";
import { prisma } from "@/lib/db/prisma";
import { listOwnHistory } from "@/lib/screening/service";
import "../screening.css";

export const metadata: Metadata = { title: "Screening history" };
export const dynamic = "force-dynamic";

export default async function ScreeningHistoryPage() {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const history = await listOwnHistory(prisma, user.id);
  if (!history.ok) return <RecordsUnavailable code={history.code === "SCHEMA" ? "SCHEMA" : "UNAVAILABLE"} />;

  return (
    <div className="screen-centre">
      <Link className="text-sm font-semibold text-[#0F766E]" href="/patient/screening">Back to Screening Centre</Link>
      <header>
        <h1 className="text-2xl font-semibold text-[#0C2B45]">My screening history</h1>
        <p className="mt-2">Completed assessments stay tied to the instrument version used at the time. A score is not a diagnosis.</p>
      </header>
      {history.rows.length === 0 ? (
        <section className="screen-panel">
          <p>No screening assessment has been submitted.</p>
          <Link className="font-semibold text-[#0F766E]" href="/patient/find">Book an appointment</Link>
        </section>
      ) : (
        <ul className="grid gap-3">
          {history.rows.map((row) => (
            <li key={row.id} className="screen-panel">
              <h2>{row.version.tool.name}</h2>
              <p>{row.version.tool.abbreviation} · Version {row.version.version}</p>
              <p>{row.submittedAt ? formatPlatformWhen(row.submittedAt) : "Time not recorded"}</p>
              {row.result ? <p>Score {row.result.score} of {row.result.maxScore} · {row.result.band}</p> : null}
              <Link className="font-semibold text-[#0F766E]" href={`/patient/screening/results/${row.id}`}>View details</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
