"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck } from "@fortawesome/free-solid-svg-icons";
import { ProfilePhoto } from "@/components/profile-photo";

export function AppointmentOverview({
  backHref,
  backLabel,
  personName,
  personUserId,
  personImageVersion,
  personDetail,
  verified,
  service,
  when,
  duration,
  modeLabel,
  statusLabel,
  paymentLabel,
  reference,
  instructions,
  place,
  message,
  joinHref,
  joinLabel = "Join consultation",
  secondaryHref,
  secondaryLabel,
  supportEmail,
  inProgressHref,
  summaryPendingText = "Your consultation has been completed. Your clinical summary is not yet available.",
  completed,
  children,
}: {
  backHref: string;
  backLabel: string;
  personName: string;
  personUserId: string;
  personImageVersion: string | null;
  personDetail: string;
  verified: boolean;
  service: string;
  when: string;
  duration: string;
  modeLabel: string;
  statusLabel: string;
  paymentLabel: string;
  reference: string;
  instructions: string | null;
  place: { name: string; address: string; phone: string | null; instructions: string | null } | null;
  message: string;
  joinHref: string | null;
  joinLabel?: string;
  secondaryHref: string | null;
  secondaryLabel: string | null;
  supportEmail: string | null;
  inProgressHref: string | null;
  summaryPendingText?: string;
  completed: {
    summaryHref: string | null;
    followUpHref: string | null;
    bookHref: string | null;
    returnHref: string;
  } | null;
  children?: React.ReactNode;
}) {
  const facts = [
    { label: "When", value: `${when} · Africa/Freetown` },
    { label: "Duration", value: duration },
    { label: "Mode", value: modeLabel },
    { label: "Payment", value: paymentLabel },
    { label: "Reference", value: reference },
  ];

  return (
    <div className="flow-page">
      <Link className="visit-back" href={backHref}>{backLabel}</Link>
      <article className="visit-id">
        <div className="visit-id-band" aria-hidden="true" />
        <ProfilePhoto userId={personUserId} name={personName} version={personImageVersion} size={96} alt={`${personName} profile photo`} />
        <div>
          <p className="visit-id-kicker">{statusLabel}</p>
          <h1>
            {personName}
            {verified ? <span className="visit-id-badge">Verified</span> : null}
          </h1>
          <p className="visit-id-role">{[service, personDetail].filter(Boolean).join(" · ")}</p>
          <ul className="visit-id-facts">
            {facts.map((fact) => (
              <li key={fact.label}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </li>
            ))}
          </ul>
          <p className="visit-id-message" role="status">{message}</p>
          {inProgressHref ? (
            <p className="visit-id-message">This consultation is in progress. You can return to the room. Leaving the video does not complete the visit.</p>
          ) : null}
          <div className="visit-id-actions">
            {joinHref ? <Link className="visit-btn" href={joinHref}>{joinLabel}</Link> : null}
            {inProgressHref ? <Link className="visit-btn" href={inProgressHref}>Return to consultation</Link> : null}
            {secondaryHref && secondaryLabel ? <Link className="visit-btn-ghost" href={secondaryHref}>{secondaryLabel}</Link> : null}
            {supportEmail ? <a className="visit-btn-ghost" href={`mailto:${supportEmail}`}>Contact support</a> : <span className="visit-id-message">A support email has not been published for this clinic.</span>}
          </div>
          {children}
        </div>
      </article>
      {instructions ? (
        <section className="visit-panel">
          <h2>Before the visit</h2>
          <p>{instructions}</p>
        </section>
      ) : null}
      {place ? (
        <section className="visit-panel">
          <h2>{place.name}</h2>
          <p>{place.address}</p>
          {place.phone ? <p>Clinic phone: {place.phone}</p> : null}
          <p>{place.instructions ?? "No arrival instructions have been added."}</p>
        </section>
      ) : null}
      {completed ? (
        <section className="flow-done" aria-labelledby="consult-complete">
          <div className="flow-done-mark" aria-hidden="true">
            <FontAwesomeIcon icon={faCircleCheck} />
          </div>
          <h2 id="consult-complete">Consultation completed</h2>
          <p>Appointment reference {reference}. {personName}. {when}.</p>
          <p>Final status: {statusLabel}.</p>
          <ul className="flow-list">
            {completed.summaryHref ? <li><Link href={completed.summaryHref}>View clinical summary</Link></li> : <li>{summaryPendingText}</li>}
            {completed.followUpHref ? <li><Link href={completed.followUpHref}>View follow-up appointment</Link></li> : null}
            {completed.bookHref ? <li><Link href={completed.bookHref}>Book a follow-up</Link></li> : null}
            <li><Link href={completed.returnHref}>Back to appointments</Link></li>
          </ul>
        </section>
      ) : null}
    </div>
  );
}
