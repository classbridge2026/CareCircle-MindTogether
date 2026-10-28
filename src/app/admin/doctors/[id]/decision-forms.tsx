"use client";

import { useActionState } from "react";
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass, textAreaClass } from "@/components/form-classes";
import {
  approveDoctorAction,
  completeDoctorAction,
  reactivateDoctorAction,
  rejectDoctorAction,
  returnDoctorAction,
  suspendDoctorAction,
  unverifyDoctorAction,
  verifySpecialtyAction,
  type AdminActionState,
} from "../actions";

const initial: AdminActionState = {};

function Notice({ state }: { state: AdminActionState }) {
  if (!state.message) return null;
  return (
    <p role={state.tone === "error" ? "alert" : "status"} className="text-sm leading-6 text-brand-ink">
      {state.message}
    </p>
  );
}

export function DoctorDecisions({
  doctorId,
  canDecide,
  canComplete,
  canUnverify,
  canSuspend,
  canReactivate,
  blockers,
  specialties,
}: {
  doctorId: string;
  canDecide: boolean;
  canComplete: boolean;
  canUnverify: boolean;
  canSuspend: boolean;
  canReactivate: boolean;
  blockers: string[];
  specialties: Array<{ id: string; name: string; claimStatus: string }>;
}) {
  const [approveState, approve, approvePending] = useActionState(approveDoctorAction, initial);
  const [rejectState, reject, rejectPending] = useActionState(rejectDoctorAction, initial);
  const [returnState, returnAction, returnPending] = useActionState(returnDoctorAction, initial);
  const [suspendState, suspend, suspendPending] = useActionState(suspendDoctorAction, initial);
  const [reactivateState, reactivate, reactivatePending] = useActionState(reactivateDoctorAction, initial);
  const [specialtyState, verifySpecialty, specialtyPending] = useActionState(verifySpecialtyAction, initial);
  const [completeState, completeProfile, completePending] = useActionState(completeDoctorAction, initial);
  const [unverifyState, unverifyProfile, unverifyPending] = useActionState(unverifyDoctorAction, initial);

  return (
    <div className="grid gap-4">
      {canComplete ? (
        <form action={completeProfile} className="grid gap-2 rounded-2xl border border-brand-line bg-white p-4">
          <h2 className="text-lg font-semibold text-brand-navy">Verify and complete profile</h2>
          <p className="text-sm leading-6 text-brand-muted">
            Patients can see this doctor only after the profile is approved, the account is active, and the primary specialty is verified. The review note completes that verification.
          </p>
          <input type="hidden" name="doctorProfileId" value={doctorId} />
          <label className="text-sm font-medium" htmlFor="complete-note">
            Review note
          </label>
          <textarea id="complete-note" name="note" required minLength={8} maxLength={500} className={textAreaClass} />
          <button className={primaryButtonClass} disabled={completePending} type="submit">
            {completePending ? "Verifying…" : "Verify profile"}
          </button>
          <Notice state={completeState} />
        </form>
      ) : null}
      {canUnverify ? (
        <form action={unverifyProfile} className="grid gap-2 rounded-2xl border border-brand-line bg-white p-4">
          <h2 className="text-lg font-semibold text-brand-navy">Mark profile incomplete</h2>
          <p className="text-sm leading-6 text-brand-muted">
            Unverify this doctor when the profile should no longer be complete. Patients stop seeing the doctor. Appointments already booked stay in place.
          </p>
          <input type="hidden" name="doctorProfileId" value={doctorId} />
          <label className="text-sm font-medium" htmlFor="unverify-note">
            Reason
          </label>
          <textarea id="unverify-note" name="note" required minLength={8} maxLength={500} className={textAreaClass} />
          <button className={dangerButtonClass} disabled={unverifyPending} type="submit">
            {unverifyPending ? "Updating…" : "Unverify profile"}
          </button>
          <Notice state={unverifyState} />
        </form>
      ) : null}
      {canDecide ? (
        <div className="grid gap-4 rounded-2xl border border-brand-line bg-white p-4">
          <h2 className="text-lg font-semibold text-brand-navy">Approve this profile</h2>
          <p className="text-sm leading-6 text-brand-muted">
            Approving lets patients view this doctor. Declining keeps the profile hidden from patients.
          </p>
          {blockers.length > 0 ? (
            <ul className="grid gap-1 rounded-xl bg-brand-paper px-3 py-3 text-sm leading-6 text-brand-ink">
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          ) : null}
          <form action={approve} className="flex flex-col gap-2">
            <input type="hidden" name="doctorProfileId" value={doctorId} />
            <button className={primaryButtonClass} disabled={approvePending || blockers.length > 0} type="submit">
              {approvePending ? "Approving…" : "Approve profile"}
            </button>
            <Notice state={approveState} />
          </form>
          <form action={reject} className="grid gap-2">
            <input type="hidden" name="doctorProfileId" value={doctorId} />
            <label className="text-sm font-medium" htmlFor="reject-reason">
              Reason for not approving
            </label>
            <textarea id="reject-reason" name="reason" required minLength={8} className={textAreaClass} />
            <button className={dangerButtonClass} disabled={rejectPending} type="submit">
              {rejectPending ? "Saving…" : "Do not approve"}
            </button>
            <Notice state={rejectState} />
          </form>
          <form action={returnAction} className="grid gap-2">
            <input type="hidden" name="doctorProfileId" value={doctorId} />
            <label className="text-sm font-medium" htmlFor="return-notes">
              Corrections requested
            </label>
            <textarea id="return-notes" name="notes" required minLength={8} className={textAreaClass} />
            <button className={secondaryButtonClass} disabled={returnPending} type="submit">
              {returnPending ? "Returning…" : "Return for corrections"}
            </button>
            <Notice state={returnState} />
          </form>
        </div>
      ) : null}
      {canSuspend ? (
        <form action={suspend} className="grid gap-2 rounded-2xl border border-brand-line bg-white p-4">
          <h2 className="text-lg font-semibold text-brand-navy">Suspend account</h2>
          <input type="hidden" name="doctorProfileId" value={doctorId} />
          <label className="text-sm font-medium" htmlFor="suspend-reason">
            Suspension reason
          </label>
          <textarea id="suspend-reason" name="reason" required minLength={8} className={textAreaClass} />
          <p className="text-sm text-brand-muted">Existing appointments stay in place and are listed below.</p>
          <button className={dangerButtonClass} disabled={suspendPending} type="submit">
            {suspendPending ? "Suspending…" : "Suspend doctor"}
          </button>
          <Notice state={suspendState} />
        </form>
      ) : null}
      {canReactivate ? (
        <form action={reactivate} className="grid gap-2 rounded-2xl border border-brand-line bg-white p-4">
          <h2 className="text-lg font-semibold text-brand-navy">Reactivate account</h2>
          <input type="hidden" name="doctorProfileId" value={doctorId} />
          <button className={primaryButtonClass} disabled={reactivatePending} type="submit">
            {reactivatePending ? "Reactivating…" : "Reactivate doctor"}
          </button>
          <Notice state={reactivateState} />
        </form>
      ) : null}
      {specialties.some((item) => item.claimStatus !== "VERIFIED") ? (
        <div className="grid gap-3 rounded-2xl border border-brand-line bg-white p-4">
          <h2 className="text-lg font-semibold text-brand-navy">Verify a declared specialty</h2>
          <Notice state={specialtyState} />
          {specialties
            .filter((item) => item.claimStatus !== "VERIFIED")
            .map((item) => (
              <form key={item.id} action={verifySpecialty} className="flex flex-wrap items-center justify-between gap-3">
                <input type="hidden" name="doctorProfileId" value={doctorId} />
                <input type="hidden" name="doctorSpecialtyId" value={item.id} />
                <span className="text-sm">
                  {item.name} · {item.claimStatus === "REJECTED" ? "Rejected claim" : "Declared"}
                </span>
                <button className={secondaryButtonClass} disabled={specialtyPending} type="submit">
                  Mark verified
                </button>
              </form>
            ))}
        </div>
      ) : null}
    </div>
  );
}
