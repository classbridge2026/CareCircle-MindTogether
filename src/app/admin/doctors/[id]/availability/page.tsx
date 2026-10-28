import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { DeactivateRuleForm, RemoveTimeOffForm, TimeOffForm, WeeklyHoursForm } from "@/app/doctor/(workspace)/availability/forms";
import { loadDoctorSchedule } from "@/lib/appointments/queries";
import { availabilityModeLabel } from "@/lib/appointments/slots";
import { parseUuid } from "@/lib/catalog/rules";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Doctor availability" };
export const dynamic = "force-dynamic";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function AdminAvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const { id } = await params;
  if (!parseUuid(id)) notFound();
  const doctor = await prisma.doctorProfile.findUnique({ where: { id }, select: { id: true, displayName: true } });
  if (!doctor) notFound();
  const schedule = await loadDoctorSchedule(prisma, doctor.id);
  if (!schedule.ok) return <RecordsUnavailable code={schedule.code} />;

  return (
    <main className="grid gap-6">
      <header>
        <p className="text-sm font-medium text-brand-teal">Doctor availability</p>
        <h1 className="mt-2 text-3xl font-semibold text-brand-navy">{doctor.displayName}</h1>
        <p className="mt-2 text-sm text-brand-muted">Changes apply to future open times. Existing appointment records stay as booked.</p>
      </header>
      {schedule.rules.length === 0 ? <p className="text-sm text-brand-muted">No weekly hours are published.</p> : (
        <ul className="grid gap-3">
          {schedule.rules.map((rule) => (
            <li key={rule.id} className="rounded-2xl border border-brand-line bg-white p-4 text-sm">
              <p className="font-semibold">{weekdays[rule.dayOfWeek - 1]} · {rule.start}–{rule.end} GMT · {availabilityModeLabel(rule.mode)}</p>
              <p className="text-brand-muted">{rule.location ?? "No clinic"} · {rule.service}</p>
              <div className="mt-3"><DeactivateRuleForm ruleId={rule.id} doctorProfileId={doctor.id} /></div>
            </li>
          ))}
        </ul>
      )}
      <WeeklyHoursForm doctorProfileId={doctor.id} offerings={schedule.offerings ?? []} />
      {schedule.timeOff.map((row) => (
        <div key={row.id} className="rounded-2xl border border-brand-line bg-white p-4 text-sm">
          <p>{row.when}</p>
          <div className="mt-3"><RemoveTimeOffForm timeOffId={row.id} doctorProfileId={doctor.id} /></div>
        </div>
      ))}
      <TimeOffForm doctorProfileId={doctor.id} />
    </main>
  );
}
