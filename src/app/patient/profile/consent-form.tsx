"use client";

import { useActionState } from "react";
import { grantConsentAction, withdrawConsentAction, type ConsentActionState } from "./consent-actions";

const initial: ConsentActionState = {};

export function ConsentActions({ consentType, active }: { consentType: string; active: boolean }) {
  const [withdrawState, withdraw, withdrawPending] = useActionState(withdrawConsentAction, initial);
  const [grantState, grant, grantPending] = useActionState(grantConsentAction, initial);
  const state = active ? withdrawState : grantState;
  return (
    <div className="mt-2">
      {active ? (
        <form action={withdraw}>
          <input name="consentType" type="hidden" value={consentType} />
          <button className="text-sm font-semibold text-[#9f1239]" disabled={withdrawPending} type="submit">
            {withdrawPending ? "Saving…" : "Withdraw"}
          </button>
        </form>
      ) : (
        <form action={grant} className="grid gap-2">
          <input name="consentType" type="hidden" value={consentType} />
          <label className="flex items-start gap-2 text-sm">
            <input className="mt-1" name="confirm" required type="checkbox" value="yes" />
            I accept the current version of this consent.
          </label>
          <button className="w-fit text-sm font-semibold text-[#0F766E]" disabled={grantPending} type="submit">
            {grantPending ? "Saving…" : "Record consent"}
          </button>
        </form>
      )}
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </div>
  );
}
