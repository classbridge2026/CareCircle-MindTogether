import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { readPageSession } from "@/lib/auth/current-user";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { loadOfferingSlots, loadOwnedAppointment } from "@/lib/appointments/queries";
import { addDays, freetownDate, parseCalendarDate } from "@/lib/appointments/time";
import { canTransition } from "@/lib/appointments/transitions";
import { prisma } from "@/lib/db/prisma";
import { OpenTimes } from "@/components/appointments/open-times";
import { RescheduleForm } from "./reschedule-form";

export const metadata: Metadata = { title: "Reschedule appointment" };
export const dynamic = "force-dynamic";

export default async function ReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const user = await readPageSession(prisma, cookieStore.get(SESSION_COOKIE)?.value, new Date());
  if (!user) return <RecordsUnavailable code="UNAVAILABLE" />;
  const owned = await loadOwnedAppointment(prisma, { id, userId: user.id, as: "patient" });
  if (!owned.ok) {
    if (owned.code === "NOT_FOUND") notFound();
    return <RecordsUnavailable code={owned.code} />;
  }
  const visit = owned.appointment;
  const allowed = canTransition({
    actor: "patient",
    ownsRecord: true,
    from: visit.status,
    to: "RESCHEDULED",
    now: new Date(),
    startsAt: visit.startsAt,
    endsAt: visit.endsAt,
    reason: "Patient requested another time",
  }).ok;
  if (!allowed || !visit.offeringId) {
    return <p className="rounded-2xl border border-brand-line bg-white p-5 text-sm">This appointment cannot be rescheduled. You can cancel it when the cancellation rules allow.</p>;
  }
  const today = freetownDate(new Date());
  const day = typeof query.date === "string" ? query.date : today;
  const start = typeof query.start === "string" ? query.start : "";
  const slots = await loadOfferingSlots(prisma, { offeringId: visit.offeringId, day, locationId: visit.locationId });
  if (!slots.ok) return <RecordsUnavailable code={slots.code === "NOT_FOUND" ? "UNAVAILABLE" : slots.code} />;
  const days = Array.from({ length: 14 }, (_, index) => addDays(parseCalendarDate(today)!, index).toISOString().slice(0, 10));
  const selected = slots.slots.find((slot) => slot.startsAt === start);

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-brand-navy">Choose another time</h1>
        <p className="mt-2 text-sm text-brand-muted">The original appointment stays in your history. The new visit is confirmed without payment. Earlier payment records stay on the original appointment.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {days.map((value) => (
          <Link key={value} href={`/patient/appointments/${visit.id}/reschedule?date=${value}`} className={`rounded-xl px-3 py-2 text-sm font-semibold ${value === day ? "bg-brand-teal text-white" : "bg-white text-brand-navy"}`}>
            {value}
          </Link>
        ))}
      </div>
      {slots.schedule.length === 0 ? (
        <p className="rounded-2xl border border-brand-line bg-white p-5 text-sm text-brand-muted">No open times on this date.</p>
      ) : (
        <OpenTimes basePath={`/patient/appointments/${visit.id}/reschedule`} date={day} selectedStart={start} slots={slots.schedule}>
          {selected ? <RescheduleForm appointmentId={visit.id} startsAt={selected.startsAt} /> : null}
        </OpenTimes>
      )}
    </div>
  );
}
