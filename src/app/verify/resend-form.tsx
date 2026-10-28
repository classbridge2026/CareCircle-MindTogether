"use client";

import { useActionState } from "react";
import { resendVerificationAction, type VerifyFormState } from "./actions";

const initialState: VerifyFormState = {};

export function ResendForm() {
  const [state, formAction, pending] = useActionState(resendVerificationAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-care-line pt-5">
      <h2 className="text-sm font-semibold text-care-ink">Resend a verification email</h2>
      <label htmlFor="resend-email" className="text-sm font-medium text-care-ink">
        Email address
      </label>
      <input id="resend-email" name="email" type="email" autoComplete="email" className="h-12 rounded-lg border border-care-line px-3" />
      {state.formMessage ? (
        <p role="status" className="text-sm leading-5 text-care-ink">
          {state.formMessage}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-lg border border-care-line text-sm font-semibold text-care-ink disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Requesting…" : "Resend"}
      </button>
    </form>
  );
}
