"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { resetPassword, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, initialState);
  const [visible, setVisible] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-brand-navy">Reset link missing</h1>
        <p className="text-base leading-6 text-brand-muted">
          Open the reset link from your email, or request another one. Email delivery is not configured, so a link cannot be sent yet.
        </p>
        <Link href="/forgot-password" className="text-sm font-semibold text-brand-teal underline">
          Request a reset
        </Link>
      </div>
    );
  }

  if (state.done) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-brand-navy">Password updated</h1>
        <p role="status" className="text-base leading-6 text-brand-ink">
          {state.formMessage}
        </p>
        <Link
          href="/login"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-brand-teal text-base font-semibold text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-brand-navy sm:text-3xl">Choose a new password</h1>
        <p className="mt-2 text-base leading-6 text-brand-muted">Use 6 to 128 characters, with at least one letter and one number.</p>
      </div>
      {state.formMessage ? (
        <p role="alert" className="rounded-xl border border-brand-danger/30 bg-[#fdf4f4] px-3 py-3 text-sm leading-5 text-brand-ink">
          {state.formMessage}
        </p>
      ) : null}
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium text-brand-ink">
          New password
        </label>
        <input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          required
          maxLength={128}
          className="h-12 w-full rounded-xl border border-brand-line bg-white px-3 text-base text-brand-ink outline-none focus:border-brand-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-brand-ink">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          required
          maxLength={128}
          className="h-12 w-full rounded-xl border border-brand-line bg-white px-3 text-base text-brand-ink outline-none focus:border-brand-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
        />
      </div>
      <button
        type="button"
        className="self-start text-sm font-semibold text-brand-teal"
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? "Hide passwords" : "Show passwords"}
      </button>
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-brand-teal text-base font-semibold text-white hover:bg-brand-teal-hover disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
