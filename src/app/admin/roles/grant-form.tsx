"use client";

import { useActionState } from "react";
import { primaryButtonClass, textInputClass } from "@/components/form-classes";
import type { AdminActionState } from "@/lib/admin/action-state";
import { grantRoleByEmailAction } from "@/app/admin/access/actions";

const initial: AdminActionState = {};

export function GrantRoleForm() {
  const [state, action, pending] = useActionState(grantRoleByEmailAction, initial);
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-navy">Grant administrator access</h2>
      <p className="text-sm leading-6 text-brand-muted">The account must already be active. This does not create a user or assign a doctor role.</p>
      <label className="text-sm font-medium">
        Account email
        <input name="email" type="email" required maxLength={254} className={`${textInputClass} mt-1`} />
      </label>
      <label className="text-sm font-medium">
        Role
        <select name="roleCode" className={`${textInputClass} mt-1`}>
          <option value="ADMIN">Administrator</option>
          <option value="SUPER_ADMIN">Super administrator</option>
        </select>
      </label>
      <button className={primaryButtonClass} disabled={pending} type="submit">
        {pending ? "Saving…" : "Grant role"}
      </button>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}
