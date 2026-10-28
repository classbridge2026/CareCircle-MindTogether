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
  return (
    <div className="flow-page">
      <Link className="visit-back" href={backHref}>{backLabel}</Link>
      <h1>Appointment details</h1>
      <article className="flow-card">
        <div className="flow-person">
          <ProfilePhoto userId={personUserId} name={personName} version={personImageVersion} size={56} alt="" />
          <div>
            <strong>
              {personName}
              {verified ? <span className="flow-badge">Verified</span> : null}
            </strong>
            <span>{personDetail}</span>
          </div>
        </div>
        <p className="flow-meta">{service}</p>
        <dl className="flow-rows">
          <div><dt>Date and time</dt><dd>{when} · Africa/Freetown</dd></div>
          <div><dt>Duration</dt><dd>{duration}</dd></div>
          <div><dt>Consultation mode</dt><dd>{modeLabel}</dd></div>
          <div><dt>Status</dt><dd>{statusLabel}</dd></div>
          <div><dt>Payment</dt><dd>{paymentLabel}</dd></div>
          <div><dt>Appointment reference</dt><dd>{reference}</dd></div>
        </dl>
        {instructions ? <p className="flow-note">{instructions}</p> : null}
        {place ? (
          <div className="flow-note">
            <strong>{place.name}</strong>
            <p>{place.address}</p>
            {place.phone ? <p>Clinic phone: {place.phone}</p> : null}
            <p>{place.instructions ?? "No arrival instructions have been added."}</p>
          </div>
        ) : null}
        <p role="status">{message}</p>
        {inProgressHref ? (
          <p className="flow-note">This consultation is in progress. You can return to the room. Leaving the video does not complete the visit.</p>
        ) : null}
        <div className="flow-actions">
          {joinHref ? <Link className="flow-btn" href={joinHref}>{joinLabel}</Link> : null}
          {inProgressHref ? <Link className="flow-btn" href={inProgressHref}>Return to consultation</Link> : null}
          {secondaryHref && secondaryLabel ? <Link className="flow-btn-ghost" href={secondaryHref}>{secondaryLabel}</Link> : null}
          {supportEmail ? <a className="flow-btn-ghost" href={`mailto:${supportEmail}`}>Contact support</a> : <span className="flow-note">A support email has not been published for this clinic.</span>}
        </div>
        {children}
      </article>
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
