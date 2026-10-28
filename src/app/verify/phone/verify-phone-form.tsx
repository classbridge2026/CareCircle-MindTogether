"use client";

import { useActionState } from "react";
import Link from "next/link";
import { verifyPhoneAction, type VerifyFormState } from "../actions";

const initialState: VerifyFormState = {};

export function VerifyPhoneForm() {
  const [state, formAction, pending] = useActionState(verifyPhoneAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-care-ink sm:text-3xl">Verify phone</h1>
        <p className="mt-2 text-base leading-6 text-care-muted">
          Enter the phone number on the account and the 6-digit code. The code is checked against that account only.
        </p>
      </div>
      {state.formMessage ? (
        <p role="alert" className="rounded-lg border border-care-line px-3 py-3 text-sm leading-5 text-care-ink">
          {state.formMessage}
        </p>
      ) : null}
      <label htmlFor="phone" className="text-sm font-medium text-care-ink">
        Phone number
      </label>
      <input id="phone" name="phone" type="tel" autoComplete="tel" required className="h-12 rounded-lg border border-care-line px-3" />
      <label htmlFor="code" className="text-sm font-medium text-care-ink">
        6-digit code
      </label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        minLength={6}
        maxLength={6}
        required
        className="h-12 rounded-lg border border-care-line px-3"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-lg bg-care-teal font-semibold text-white disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Checking code…" : "Verify phone"}
      </button>
      <Link href="/verify" className="text-sm font-medium text-care-teal underline">
        Resend or use an email code
      </Link>
    </form>
  );
}
