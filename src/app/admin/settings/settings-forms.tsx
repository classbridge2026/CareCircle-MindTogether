"use client";

import { useActionState } from "react";
import { primaryButtonClass, textInputClass } from "@/components/form-classes";
import type { AdminActionState } from "@/lib/admin/action-state";
import { updateCurrencySettingAction, updateHoldSettingAction, updateSystemNameAction } from "./actions";

const initial: AdminActionState = {};

export function SystemNameForm({ systemName }: { systemName: string }) {
  const [state, action, pending] = useActionState(updateSystemNameAction, initial);
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-navy">System name</h2>
      <p className="text-sm leading-6 text-brand-muted">
        This name is shown on the public site, in the patient, doctor, and administration portals, in the browser title, and in emails sent after you save.
      </p>
      <label className="text-sm font-medium">
        System name
        <input name="systemName" required minLength={2} maxLength={80} defaultValue={systemName} className={`${textInputClass} mt-1`} />
      </label>
      <button className={primaryButtonClass} disabled={pending} type="submit">
        {pending ? "Saving…" : "Save system name"}
      </button>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}

export function CurrencySettingForm({ currency }: { currency: string }) {
  const [state, action, pending] = useActionState(updateCurrencySettingAction, initial);
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-navy">Default currency</h2>
      <p className="text-sm leading-6 text-brand-muted">Used for new catalog prices. Existing service fees and booked appointment snapshots stay as they were.</p>
      <label className="text-sm font-medium">
        Currency code
        <input name="currency" required maxLength={3} defaultValue={currency} className={`${textInputClass} mt-1`} />
      </label>
      <button className={primaryButtonClass} disabled={pending} type="submit">
        {pending ? "Saving…" : "Save currency"}
      </button>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}

export function HoldSettingForm({ minutes }: { minutes: number | null }) {
  const [state, action, pending] = useActionState(updateHoldSettingAction, initial);
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-navy">Appointment payment hold</h2>
      <p className="text-sm leading-6 text-brand-muted">New unpaid bookings expire after this many minutes. Allowed range is 5 to 120. Existing holds are not rewritten.</p>
      <label className="text-sm font-medium">
        Minutes
        <input name="minutes" required inputMode="numeric" min={5} max={120} defaultValue={minutes ?? 10} className={`${textInputClass} mt-1`} />
      </label>
      <button className={primaryButtonClass} disabled={pending} type="submit">
        {pending ? "Saving…" : "Save hold"}
      </button>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}
