"use client";

import { useActionState, useState } from "react";
import { primaryButtonClass, textInputClass } from "@/components/form-classes";
import { acceptInvitationAction, type AcceptInvitationState } from "./actions";

const initial: AcceptInvitationState = {};

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, initial);
  const [visible, setVisible] = useState(false);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-brand-navy">Set your password</h1>
        <p className="mt-2 text-base leading-6 text-brand-muted">
          Use 6 to 128 characters, with at least one letter and one number. This invitation cannot assign an administrator role.
        </p>
      </div>
      {state.formMessage ? (
        <p role="alert" className="rounded-xl border border-brand-danger/30 bg-[#fdf4f4] px-3 py-3 text-sm leading-6">
          {state.formMessage}
        </p>
      ) : null}
      <input type="hidden" name="token" value={token} />
      <label className="text-sm font-medium" htmlFor="password">
        Password
        <input id="password" name="password" type={visible ? "text" : "password"} autoComplete="new-password" required maxLength={128} className={`${textInputClass} mt-1`} />
      </label>
      <label className="text-sm font-medium" htmlFor="confirmPassword">
        Confirm password
        <input id="confirmPassword" name="confirmPassword" type={visible ? "text" : "password"} autoComplete="new-password" required maxLength={128} className={`${textInputClass} mt-1`} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} />
        Show password
      </label>
      <button className={primaryButtonClass} disabled={pending} type="submit">
        {pending ? "Saving…" : "Create password and continue"}
      </button>
    </form>
  );
}
