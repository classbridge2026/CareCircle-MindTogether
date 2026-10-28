"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestReset, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-brand-navy sm:text-3xl">
          Reset your password
        </h1>
        <p className="mt-2 text-base leading-6 text-brand-muted">
          Enter the email address or phone number on the account. A reset message is sent only when email delivery is configured.
        </p>
      </div>

      {state.formMessage ? (
        <p role="status" className="rounded-xl border border-brand-line bg-brand-paper px-3 py-3 text-sm leading-5 text-brand-ink">
          {state.formMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="identifier" className="text-sm font-medium text-brand-ink">
          Email address or phone number
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          aria-invalid={state.identifierError ? true : undefined}
          aria-describedby={state.identifierError ? "identifier-error" : undefined}
          placeholder="name@email.com or phone number"
          className={`h-12 w-full rounded-xl border bg-white px-3 text-base text-brand-ink outline-none placeholder:text-brand-muted/80 focus:border-brand-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal ${
            state.identifierError ? "border-brand-danger" : "border-brand-line"
          }`}
        />
        {state.identifierError ? (
          <p id="identifier-error" className="text-sm leading-5 text-brand-danger">
            {state.identifierError}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-teal text-base font-semibold text-white hover:bg-brand-teal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Checking…" : "Request reset"}
      </button>

      <Link href="/login" className="text-sm font-semibold text-brand-teal underline decoration-brand-teal/40 underline-offset-2">
        Back to sign in
      </Link>
    </form>
  );
}
