"use client";

import { useActionState } from "react";
import { savePortalNoteAction, type PortalNoteState } from "./actions";

const initial: PortalNoteState = {};

export function PortalNoteForm({ visits }: { visits: Array<{ id: string; label: string }> }) {
  const [state, action, pending] = useActionState(savePortalNoteAction, initial);
  if (visits.length === 0) {
    return <p className="text-sm leading-6 text-[#5b6b7c]">Open a consultation record before adding a note. Notes stay attached to that visit.</p>;
  }
  return (
    <form action={action} className="grid gap-3">
      <label className="text-sm font-medium text-[#0C2B45]">
        Visit
        <select className="mt-1 h-11 w-full rounded-lg border border-[#d7e3ee] px-3" name="appointmentId" required>
          {visits.map((visit) => <option key={visit.id} value={visit.id}>{visit.label}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-[#0C2B45]">
        Note type
        <select className="mt-1 h-11 w-full rounded-lg border border-[#d7e3ee] px-3" name="kind" defaultValue="PRIVATE_WORKING">
          <option value="PRIVATE_WORKING">Working note</option>
          <option value="PATIENT_SUMMARY">Patient summary</option>
        </select>
      </label>
      <label className="text-sm font-medium text-[#0C2B45]">
        Note
        <textarea className="mt-1 min-h-32 w-full rounded-lg border border-[#d7e3ee] px-3 py-2" maxLength={8000} name="body" required />
      </label>
      <p className="text-xs leading-5 text-[#5b6b7c]">A working note stays on your record. A patient summary stays hidden until you release it from the consultation.</p>
      <button className="h-11 rounded-lg bg-[#0F766E] text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving…" : "Save note"}</button>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}
