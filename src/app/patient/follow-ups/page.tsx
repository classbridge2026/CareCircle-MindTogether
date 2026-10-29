import type { Metadata } from "next";
import Link from "next/link";
import { ProfilePhoto } from "@/components/profile-photo";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { StatusBadge } from "@/components/status-badge";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { appointmentStatusLabel, appointmentStatusTone } from "@/lib/admin/labels";
import { prisma } from "@/lib/db/prisma";
import { listPatientFollowUps } from "@/lib/patient/portal";
import { parseFollowUpView, type FollowUpView } from "@/lib/doctor/present";

export const metadata: Metadata = { title: "Follow-ups" };
export const dynamic = "force-dynamic";

const views: Array<{ id: FollowUpView; label: string }> = [
  { id: "upcoming", label: "Upcoming" },
  { id: "today", label: "Due today" },
  { id: "overdue", label: "Overdue" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

export default async function PatientFollowUpsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const query = await searchParams;
  const view = parseFollowUpView(query.view);
  const result = await listPatientFollowUps(prisma, user.id, view);
  if (!result.ok) return <RecordsUnavailable code={result.code} />;

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#0C2B45]">Follow-ups</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5b6b7c]">These are follow-up appointments booked for you. You can view them and book another visit. Completing a clinical encounter stays with your doctor.</p>
        </div>
        <Link className="inline-flex h-11 items-center rounded-lg bg-[#0F766E] px-4 text-sm font-semibold text-white" href="/patient/find">Book appointment</Link>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="Follow-up views">
        {views.map((item) => (
          <Link key={item.id} href={`/patient/follow-ups?view=${item.id}`} aria-current={view === item.id ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === item.id ? "bg-[#0F766E] text-white" : "bg-white text-[#0C2B45]"}`}>
            {item.label}
          </Link>
        ))}
      </nav>
      {result.visits.length === 0 ? (
        <p className="rounded-2xl border border-[#d7e3ee] bg-white p-5 text-sm text-[#5b6b7c]">No follow-up is in this view.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#d7e3ee] bg-white">
          <table className="phone-table w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs tracking-wide text-[#5b6b7c] uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Doctor</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.visits.map((visit) => (
                <tr key={visit.id} className="border-t border-[#e6eef5]">
                  <td className="px-4 py-3" data-label="Date">{visit.when}</td>
                  <td className="px-4 py-3" data-label="Doctor">
                    <span className="flex items-center gap-2">
                      <ProfilePhoto userId={visit.doctorUserId} name={visit.doctor} version={visit.doctorImageVersion} size={32} alt="" />
                      {visit.doctor}
                    </span>
                  </td>
                  <td className="px-4 py-3" data-label="Reason">{visit.service}<div className="text-xs text-[#5b6b7c]">{visit.specialty} · {visit.mode === "ONLINE" ? "Online" : "In person"}</div></td>
                  <td className="px-4 py-3" data-label="Status"><StatusBadge tone={appointmentStatusTone(visit.status)}>{appointmentStatusLabel(visit.status)}</StatusBadge></td>
                  <td className="px-4 py-3" data-label="Actions"><Link className="font-semibold text-[#0F766E]" href={`/patient/appointments/${visit.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
