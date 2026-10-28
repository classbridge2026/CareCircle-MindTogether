"use client";

import { useActionState } from "react";
import { textAreaClass } from "@/components/form-classes";
import type { AdminActionState } from "@/lib/admin/action-state";
import { cancelAppointmentAction } from "../actions";

const initial: AdminActionState = {};

export function CancelAppointmentForm({ appointmentId }: { appointmentId: string }) {
  const [state, action, pending] = useActionState(cancelAppointmentAction, initial);
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-navy">Cancel appointment</h2>
      <p className="text-sm leading-6 text-brand-muted">
        This records you as the actor and leaves payment status unchanged. Reassignment is not available.
      </p>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <label className="text-sm font-medium">
        Operational reason
        <textarea name="reason" required minLength={10} maxLength={500} className={`${textAreaClass} mt-1`} />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input name="confirm" type="checkbox" required className="mt-1" />
        I understand this cancellation is recorded and the original fee stays on the appointment.
      </label>
      <button className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-danger px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Cancelling…" : "Cancel appointment"}
      </button>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}
