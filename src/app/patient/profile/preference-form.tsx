"use client";

import { useActionState } from "react";
import { saveReminderPreferenceAction, type PreferenceState } from "./preference-actions";

const initial: PreferenceState = {};

export function ReminderPreferenceForm({
  emailReminders,
  available,
}: {
  emailReminders: boolean;
  available: boolean;
}) {
  const [state, action, pending] = useActionState(saveReminderPreferenceAction, initial);
  if (!available) {
    return <p>Reminder choices are not available until the notification migration is applied. Security messages are unaffected.</p>;
  }
  return (
    <form action={action} className="grid gap-3">
      <p>Optional appointment email reminders. Verification and password recovery emails cannot be turned off.</p>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="emailReminders" defaultChecked={emailReminders} />
        Email reminders
      </label>
      <button type="submit" disabled={pending} className="w-fit rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Saving" : "Save reminder choices"}
      </button>
      {state.message ? <p>{state.message}</p> : null}
    </form>
  );
}
