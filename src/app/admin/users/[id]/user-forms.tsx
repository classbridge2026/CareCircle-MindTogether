"use client";

import { useActionState } from "react";
import { primaryButtonClass, textAreaClass, textInputClass } from "@/components/form-classes";
import type { AdminActionState } from "@/lib/admin/action-state";
import { updateAccountStatusAction, updateRoleAction } from "@/app/admin/access/actions";

const initial: AdminActionState = {};

export function UserAccountForms({
  userId,
  canSuspend,
  canReactivate,
  canManagePrivileges,
  grantCodes,
  revokeCodes,
}: {
  userId: string;
  canSuspend: boolean;
  canReactivate: boolean;
  canManagePrivileges: boolean;
  grantCodes: string[];
  revokeCodes: string[];
}) {
  const [statusState, statusAction, statusPending] = useActionState(updateAccountStatusAction, initial);
  const [roleState, roleAction, rolePending] = useActionState(updateRoleAction, initial);
  return (
    <div className="grid gap-4">
      {canSuspend || canReactivate ? (
        <form action={statusAction} className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
          <h2 className="text-lg font-semibold text-brand-navy">{canSuspend ? "Suspend account" : "Reactivate account"}</h2>
          <p className="text-sm leading-6 text-brand-muted">
            Suspension blocks sign-in and revokes open sessions. The profile, appointments, and payment history stay in place.
          </p>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="change" value={canSuspend ? "suspend" : "reactivate"} />
          <label className="text-sm font-medium">
            Operational reason
            <textarea name="reason" required minLength={10} maxLength={500} className={`${textAreaClass} mt-1`} />
          </label>
          <button className={canSuspend ? "inline-flex h-11 items-center justify-center rounded-xl bg-brand-danger px-4 text-sm font-semibold text-white" : primaryButtonClass} disabled={statusPending} type="submit">
            {statusPending ? "Saving…" : canSuspend ? "Suspend account" : "Reactivate account"}
          </button>
          {statusState.message ? <p role={statusState.tone === "error" ? "alert" : "status"}>{statusState.message}</p> : null}
        </form>
      ) : null}
      {canManagePrivileges ? (
        <form action={roleAction} className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
          <h2 className="text-lg font-semibold text-brand-navy">Administrator roles</h2>
          <p className="text-sm leading-6 text-brand-muted">Patient and doctor roles stay with registration and doctor onboarding. You cannot change your own roles.</p>
          <input type="hidden" name="userId" value={userId} />
          <label className="text-sm font-medium">
            Change
            <select name="roleChange" className={`${textInputClass} mt-1`} required>
              {grantCodes.map((code) => (
                <option key={`grant-${code}`} value={`grant:${code}`}>
                  Grant {code === "SUPER_ADMIN" ? "super administrator" : "administrator"}
                </option>
              ))}
              {revokeCodes.map((code) => (
                <option key={`revoke-${code}`} value={`revoke:${code}`}>
                  Remove {code === "SUPER_ADMIN" ? "super administrator" : "administrator"}
                </option>
              ))}
            </select>
          </label>
          {grantCodes.length > 0 || revokeCodes.length > 0 ? (
            <button className={primaryButtonClass} disabled={rolePending} type="submit">
              {rolePending ? "Saving…" : "Save role change"}
            </button>
          ) : null}
          {grantCodes.length === 0 && revokeCodes.length === 0 ? <p className="text-sm text-brand-muted">No administrator role change is available for this account.</p> : null}
          {roleState.message ? <p role={roleState.tone === "error" ? "alert" : "status"}>{roleState.message}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
