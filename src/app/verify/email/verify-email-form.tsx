"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { verifyEmailAction, type VerifyFormState } from "../actions";

const initialState: VerifyFormState = {};

export function VerifyEmailForm({ systemName }: { systemName: string }) {
  const [state, formAction, pending] = useActionState(verifyEmailAction, initialState);
  const tokenRef = useRef<HTMLTextAreaElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    const token = window.location.hash.replace(/^#/, "");
    if (!token || !tokenRef.current || submitted.current) {
      return;
    }
    tokenRef.current.value = token;
    window.history.replaceState(null, "", window.location.pathname);
    submitted.current = true;
    tokenRef.current.form?.requestSubmit();
  }, []);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-care-ink sm:text-3xl">Verify email</h1>
        <p className="mt-2 text-base leading-6 text-care-muted">
          Paste the verification code from your email. {systemName} does not put this code in the page address after it is read.
        </p>
      </div>
      {state.formMessage ? (
        <p role="alert" className="rounded-lg border border-care-line px-3 py-3 text-sm leading-5 text-care-ink">
          {state.formMessage}
        </p>
      ) : null}
      <label htmlFor="token" className="text-sm font-medium text-care-ink">
        Email verification code
      </label>
      <textarea
        ref={tokenRef}
        id="token"
        name="token"
        required
        rows={3}
        autoComplete="one-time-code"
        className="rounded-lg border border-care-line px-3 py-2 text-base"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-lg bg-care-teal font-semibold text-white disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Checking code…" : "Verify email"}
      </button>
      <Link href="/verify" className="text-sm font-medium text-care-teal underline">
        Resend the email
      </Link>
    </form>
  );
}
