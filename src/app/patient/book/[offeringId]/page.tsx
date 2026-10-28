import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfilePhoto } from "@/components/profile-photo";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { loadOfferingSlots } from "@/lib/appointments/queries";
import { freetownDate, parseCalendarDate, addDays } from "@/lib/appointments/time";
import { prisma } from "@/lib/db/prisma";
import { OpenTimes } from "@/components/appointments/open-times";
import { VisitIcon } from "@/app/patient/appointments/[id]/visit-icons";
import { ConfirmBookingForm } from "./confirm-form";
import "../../appointments/[id]/appointment-visit.css";
import "../book.css";

export const metadata: Metadata = { title: "Book an appointment" };
export const dynamic = "force-dynamic";

function dayParts(iso: string, today: string) {
  const date = parseCalendarDate(iso);
  if (!date) return { weekday: "", number: iso, month: "" };
  return {
    weekday: iso === today ? "Today" : date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
    number: String(date.getUTCDate()),
    month: date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
  };
}

function longDay(iso: string) {
  const date = parseCalendarDate(iso);
  if (!date) return iso;
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export default async function BookOfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ offeringId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { offeringId } = await params;
  const query = await searchParams;
  const today = freetownDate(new Date());
  const requested = typeof query.date === "string" ? query.date : today;
  const locationId = typeof query.location === "string" ? query.location : "";
  const start = typeof query.start === "string" ? query.start : "";
  const result = await loadOfferingSlots(prisma, { offeringId, day: requested, locationId: locationId || null });
  if (!result.ok) {
    if (result.code === "NOT_FOUND") notFound();
    return <RecordsUnavailable code={result.code} />;
  }
  const { offering, locations, slots, schedule } = result;
  const days = Array.from({ length: 14 }, (_, index) => addDays(parseCalendarDate(today)!, index).toISOString().slice(0, 10));
  const selected = slots.find((slot) => slot.startsAt === start);
  const location = locations.find((row) => row.id === locationId);
  const online = offering.mode === "ONLINE";

  return (
    <div className="book-page">
      <Link className="visit-back" href={`/patient/doctors/${offering.doctorId}`}>
        <VisitIcon name="back" />
        Doctor profile
      </Link>

      <section className="book-hero">
        <div className="book-hero-top">
          <div className="book-hero-copy">
            <p className="visit-kicker">{offering.specialty}</p>
            <h1>{offering.service}</h1>
            <p>Choose a day and time, such as 4:00 PM.</p>
            <div className="book-facts">
              <span className="book-chip">
                <VisitIcon name={online ? "video" : "hospital"} />
                {online ? "Online" : "In person"}
              </span>
              <span className="book-chip">
                <VisitIcon name="clock" />
                {offering.durationMinutes} min
              </span>
              <span className="book-chip">
                <VisitIcon name="payment" />
                {offering.fee}
              </span>
            </div>
          </div>
          <div className="book-doctor">
            <ProfilePhoto userId={offering.doctorUserId} name={offering.doctorName} version={offering.doctorImageVersion} size={56} alt="" />
            <span>
              <small>Clinician</small>
              <strong>{offering.doctorName}</strong>
            </span>
          </div>
        </div>
      </section>

      {offering.mode === "IN_PERSON" ? (
        locations.length === 0 ? (
          <p className="book-panel book-hint">This doctor has not published an in-person clinic for this consultation.</p>
        ) : (
          <section className="book-panel">
            <h2>Clinic</h2>
            <div className="book-clinics">
              {locations.map((row) => (
                <Link
                  key={row.id}
                  href={`/patient/book/${offering.id}?date=${requested}&location=${row.id}`}
                  className={`book-clinic${row.id === locationId ? " book-clinic-on" : ""}`}
                >
                  {row.label}
                </Link>
              ))}
            </div>
            {!location ? <p className="book-hint">Choose a clinic to see in-person times.</p> : null}
          </section>
        )
      ) : null}

      <section className="book-panel">
        <h2>{longDay(requested)}</h2>
        <div className="book-days" role="list">
          {days.map((day) => {
            const parts = dayParts(day, today);
            return (
              <Link
                key={day}
                role="listitem"
                href={`/patient/book/${offering.id}?date=${day}${locationId ? `&location=${locationId}` : ""}`}
                className={`book-day${day === requested ? " book-day-on" : ""}`}
                aria-current={day === requested ? "date" : undefined}
              >
                <small>{parts.weekday}</small>
                <strong>{parts.number}</strong>
                <small>{parts.month}</small>
              </Link>
            );
          })}
        </div>
      </section>

      {offering.mode === "IN_PERSON" && !location ? null : schedule.length === 0 ? (
        <p className="book-panel book-hint">No open times on this date. Try another day.</p>
      ) : (
        <section className="book-panel">
          <h2>Available times</h2>
          <OpenTimes basePath={`/patient/book/${offering.id}`} date={requested} locationId={locationId} selectedStart={start} slots={schedule}>
            {selected ? (
              <section className="book-review">
                <h2>Review booking</h2>
                <p>
                  {offering.doctorName} · {offering.service} · {online ? "Online" : "In person"} · {selected.label}
                  {location ? ` · ${location.label}` : ""} · {offering.fee}
                </p>
                <p>This request holds the time until the doctor approves or declines it. Until then it stays under Pending.</p>
                <ConfirmBookingForm offeringId={offering.id} startsAt={selected.startsAt} locationId={location?.id ?? ""} />
              </section>
            ) : null}
          </OpenTimes>
        </section>
      )}
    </div>
  );
}
