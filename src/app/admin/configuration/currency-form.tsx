"use client";

import { useActionState } from "react";
import { primaryButtonClass, textInputClass } from "@/components/form-classes";
import { updateCurrencyAction, type ConfigurationActionState } from "./actions";

const initial: ConfigurationActionState = {};

export function CurrencyForm({ currency }: { currency: string }) {
  const [state, action, pending] = useActionState(updateCurrencyAction, initial);
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-end">
      <label className="text-sm font-medium">
        Default currency
        <input name="currency" required maxLength={3} defaultValue={currency} className={`${textInputClass} mt-1`} />
      </label>
      <button className={primaryButtonClass} disabled={pending} type="submit">
        {pending ? "Saving…" : "Save currency"}
      </button>
      {state.message ? (
        <p className="sm:col-span-2" role={state.tone === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
