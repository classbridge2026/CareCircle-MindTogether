"use client";

import { useActionState, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { OpenTimes, type BookingTime } from "@/components/appointments/open-times";
import { dangerButtonClass, primaryButtonClass, textAreaClass } from "@/components/form-classes";
import { doctorBookingDecisionAction, doctorCancelAction, doctorRescheduleAction, doctorStatusAction, type DoctorActionState } from "../actions";

const APPROVE_TIME_HASH = "approve-new-time";
const DECLINE_HASH = "decline-booking";
const RESCHEDULE_HASH = "reschedule";

const actionLabel = { CHECKED_IN: "Check in", IN_PROGRESS: "Start visit", COMPLETED: "Complete", NO_SHOW: "Mark no show" };

const initial: DoctorActionState = {};

function dayLabel(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function useHashDialog(hash: string) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    if (window.location.hash.replace("#", "") !== hash) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, [hash]);
  const show = useCallback(() => {
    setOpen(true);
    if (window.location.hash.replace("#", "") === hash) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${hash}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, [hash]);
  useEffect(() => {
    function sync() {
      setOpen(window.location.hash.replace("#", "") === hash);
    }
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [hash]);
  return { open, show, close };
}

function VisitDialog({ title, purpose, titleId, kicker = "Booking request", onClose, children }: { title: string; purpose: string; titleId: string; kicker?: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div className="doc-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="doc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="doc-dialog-head">
          <div>
            <p className="doc-dialog-kicker">{kicker}</p>
            <h2 id={titleId}>{title}</h2>
            <p>{purpose}</p>
          </div>
          <button className="doc-dialog-close" type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ApproveNewTimeButton({
  appointmentId,
  days,
  date,
  locationId,
  slots,
  selectedStart,
}: {
  appointmentId: string;
  days: string[];
  date: string;
  locationId: string;
  slots: { ok: true; schedule: BookingTime[] } | { ok: false } | null;
  selectedStart: string;
}) {
  const { open, show, close } = useHashDialog(APPROVE_TIME_HASH);
  const schedule = slots?.ok ? slots.schedule : [];
  const selected = schedule.find((slot) => slot.startsAt === selectedStart && slot.availability === "open");
  return (
    <>
      <button className={`${primaryButtonClass} w-full`} type="button" onClick={show}>
        Approve at another time
      </button>
      {open ? (
        <VisitDialog
          title="Approve at another time"
          titleId="approve-new-time-title"
          purpose="Choose a new open time and write the reason. Saving it approves this request. Times marked Booked belong to another patient."
          onClose={close}
        >
          <div className="doc-dialog-days" aria-label="Days">
            {days.map((value) => (
              <Link key={value} className={value === date ? "doc-dialog-day doc-dialog-day-on" : "doc-dialog-day"} href={`/doctor/appointments/${appointmentId}?date=${value}#${APPROVE_TIME_HASH}`}>
                {dayLabel(value)}
              </Link>
            ))}
          </div>
          {!slots || !slots.ok ? <p className="doc-quiet">Open times could not be loaded for this date.</p> : null}
          {slots?.ok && schedule.length === 0 ? <p className="doc-quiet">No open times on this date.</p> : null}
          {slots?.ok && schedule.length > 0 ? (
            <OpenTimes basePath={`/doctor/appointments/${appointmentId}`} date={date} hash={APPROVE_TIME_HASH} locationId={locationId} selectedStart={selectedStart} slots={schedule}>
              {selected ? <DoctorRescheduleForm appointmentId={appointmentId} missed={false} approveRequest startsAt={selected.startsAt} /> : null}
            </OpenTimes>
          ) : null}
        </VisitDialog>
      ) : null}
    </>
  );
}

export function RescheduleButton({
  appointmentId,
  days,
  date,
  locationId,
  slots,
  selectedStart,
  missed,
}: {
  appointmentId: string;
  days: string[];
  date: string;
  locationId: string;
  slots: { ok: true; schedule: BookingTime[] } | { ok: false } | null;
  selectedStart: string;
  missed: boolean;
}) {
  const { open, show, close } = useHashDialog(RESCHEDULE_HASH);
  const schedule = slots?.ok ? slots.schedule : [];
  const selected = schedule.find((slot) => slot.startsAt === selectedStart && slot.availability === "open");
  const purpose = missed
    ? "This visit time has passed and the consultation was not completed. Choose a new open time and write the reason. The patient will see it in My Appointments."
    : "Choose a new open time and write the reason. The patient will see it in My Appointments. Times marked Booked belong to another patient.";
  return (
    <>
      <button className={`${primaryButtonClass} w-full`} type="button" onClick={show}>
        Reschedule
      </button>
      {open ? (
        <VisitDialog title="Reschedule" titleId="reschedule-title" kicker="Appointment" purpose={purpose} onClose={close}>
          <div className="doc-dialog-days" aria-label="Days">
            {days.map((value) => (
              <Link key={value} className={value === date ? "doc-dialog-day doc-dialog-day-on" : "doc-dialog-day"} href={`/doctor/appointments/${appointmentId}?date=${value}#${RESCHEDULE_HASH}`}>
                {dayLabel(value)}
              </Link>
            ))}
          </div>
          {!slots || !slots.ok ? <p className="doc-quiet">Open times could not be loaded for this date.</p> : null}
          {slots?.ok && schedule.length === 0 ? <p className="doc-quiet">No open times on this date.</p> : null}
          {slots?.ok && schedule.length > 0 ? (
            <OpenTimes basePath={`/doctor/appointments/${appointmentId}`} date={date} hash={RESCHEDULE_HASH} locationId={locationId} selectedStart={selectedStart} slots={schedule}>
              {selected ? <DoctorRescheduleForm appointmentId={appointmentId} missed={missed} startsAt={selected.startsAt} /> : null}
            </OpenTimes>
          ) : null}
        </VisitDialog>
      ) : null}
    </>
  );
}

function DeclineBookingButton({ appointmentId }: { appointmentId: string }) {
  const { open, show, close } = useHashDialog(DECLINE_HASH);
  const [declineState, declineAction, declinePending] = useActionState(doctorBookingDecisionAction, initial);
  return (
    <>
      <button className={`${dangerButtonClass} h-12 w-full text-base`} type="button" onClick={show}>
        Decline booking
      </button>
      {open ? (
        <VisitDialog
          title="Decline booking"
          titleId="decline-booking-title"
          purpose="Write the reason. The patient will see it, and this time becomes available for another patient."
          onClose={close}
        >
          <form action={declineAction} className="grid gap-3">
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <input type="hidden" name="decision" value="decline" />
            <label className="text-sm font-medium">
              Reason for declining
              <textarea name="reason" required minLength={10} maxLength={500} className={`${textAreaClass} mt-1`} placeholder="Why this request is declined." />
            </label>
            <label className="doc-check">
              <input name="confirm" required type="checkbox" value="yes" />
              Decline this booking. The time becomes available for another patient.
            </label>
            <button className={`${dangerButtonClass} h-12 w-full text-base`} disabled={declinePending} type="submit">{declinePending ? "Saving…" : "Decline booking"}</button>
            {declineState.message ? <p role="alert">{declineState.message}</p> : null}
          </form>
        </VisitDialog>
      ) : null}
    </>
  );
}

export function DoctorBookingDecision({ appointmentId, canApprove, offerNewTime = false, children }: { appointmentId: string; canApprove: boolean; offerNewTime?: boolean; children?: ReactNode }) {
  const [approveState, approveAction, approvePending] = useActionState(doctorBookingDecisionAction, initial);
  return (
    <div className="grid gap-4">
      {canApprove ? (
        <form action={approveAction} className="grid gap-3">
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <input type="hidden" name="decision" value="approve" />
          <button className={primaryButtonClass} disabled={approvePending} type="submit">{approvePending ? "Saving…" : "Approve booking"}</button>
          {approveState.message ? <p role="status">{approveState.message}</p> : null}
        </form>
      ) : (
        <>
          <p className="doc-quiet">{offerNewTime ? "This requested time has passed. Choose another open time and give a reason to approve the request." : "This requested time has passed. Decline it so the patient can choose another time."}</p>
          {children}
        </>
      )}
      <DeclineBookingButton appointmentId={appointmentId} />
    </div>
  );
}

export function DoctorRescheduleForm({
  appointmentId,
  startsAt,
  missed,
  approveRequest = false,
}: {
  appointmentId: string;
  startsAt: string;
  missed: boolean;
  approveRequest?: boolean;
}) {
  const [rescheduleState, rescheduleAction, reschedulePending] = useActionState(doctorRescheduleAction, initial);
  return (
    <form action={rescheduleAction} className="grid gap-3">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <label className="text-sm font-medium">
        Reason
        <textarea name="reason" required minLength={10} maxLength={500} className={`${textAreaClass} mt-1`} placeholder={approveRequest ? "The requested time has passed, so this is the new time." : missed ? "The visit time passed before we met." : "Why this appointment is moving."} />
      </label>
      <label className="doc-check">
        <input name="confirm" required type="checkbox" value="yes" />
        {approveRequest
          ? "Approve this request at the selected time. The patient will see the new appointment and this reason."
          : missed
            ? "Move this missed visit to the selected open time. The patient will see the new appointment."
            : "Replace the current appointment with the selected open time. The patient will see the new appointment."}
      </label>
      <button className={primaryButtonClass} disabled={reschedulePending} type="submit">{reschedulePending ? "Saving…" : approveRequest ? "Approve at this time" : "Reschedule"}</button>
      {rescheduleState.message ? <p role="alert">{rescheduleState.message}</p> : null}
    </form>
  );
}

export function DoctorAppointmentForms({
  appointmentId,
  actions,
  canCancel,
}: {
  appointmentId: string;
  actions: Array<"CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "NO_SHOW">;
  canCancel: boolean;
}) {
  const [statusState, statusAction, statusPending] = useActionState(doctorStatusAction, initial);
  const [cancelState, cancelAction, cancelPending] = useActionState(doctorCancelAction, initial);

  const routine = actions.filter((action) => action !== "COMPLETED");
  return (
    <div className="doc-forms">
      {actions.length > 0 ? (
        <form action={statusAction}>
          <h2>Visit actions</h2>
          <p className="doc-quiet">Check-in and start visit open the clinical record. Completing the visit closes the appointment.</p>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <div className="doc-actions">
            {routine.map((action) => (
              <button key={action} className={primaryButtonClass} name="to" value={action} disabled={statusPending} type="submit">
                {actionLabel[action]}
              </button>
            ))}
          </div>
          {actions.includes("COMPLETED") ? (
            <>
              <label className="doc-check">
                <input name="confirm" type="checkbox" value="yes" />
                I have finished this clinical encounter. Completing it closes the appointment.
              </label>
              <button className={primaryButtonClass} name="to" value="COMPLETED" disabled={statusPending} type="submit">
                Complete consultation
              </button>
            </>
          ) : null}
          {statusState.message ? <p role="status">{statusState.message}</p> : null}
        </form>
      ) : null}
      {canCancel ? (
        <form action={cancelAction}>
          <h2>Cancel</h2>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <label className="text-sm font-medium">Reason<textarea name="reason" required minLength={10} maxLength={500} className={`${textAreaClass} mt-1`} /></label>
          <label className="flex items-start gap-2 text-sm">
            <input className="mt-1" name="confirm" required type="checkbox" value="yes" />
            I understand this cancels the appointment.
          </label>
          <button className={dangerButtonClass} disabled={cancelPending} type="submit">{cancelPending ? "Cancelling…" : "Cancel appointment"}</button>
          {cancelState.message ? <p role="alert">{cancelState.message}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
