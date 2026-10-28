"use client";

import { useActionState } from "react";
import { resendInvitationAction, revokeInvitationAction, type InvitationActionState } from "./actions";

const initial: InvitationActionState = {};

export function InvitationControls({ invitationId, pending }: { invitationId: string; pending: boolean }) {
  const [resendState, resend, resendPending] = useActionState(resendInvitationAction, initial);
  const [revokeState, revoke, revokePending] = useActionState(revokeInvitationAction, initial);
  const message = resendState.message ?? revokeState.message;
  const tone = resendState.message ? resendState.tone : revokeState.tone;
  return (
    <>
      {pending ? (
        <div className="user-actions">
          <form action={resend}>
            <input type="hidden" name="invitationId" value={invitationId} />
            <button className="users-cancel" type="submit" disabled={resendPending}>
              {resendPending ? "Sending…" : "Resend"}
            </button>
          </form>
          <form action={revoke}>
            <input type="hidden" name="invitationId" value={invitationId} />
            <button className="users-delete" type="submit" disabled={revokePending}>
              {revokePending ? "Revoking…" : "Revoke"}
            </button>
          </form>
        </div>
      ) : (
        <span className="users-sub">No action</span>
      )}
      {message ? (
        <span role={tone === "error" || tone === "warn" ? "alert" : "status"} className={tone === "error" || tone === "warn" ? "user-form-error" : "users-sub"}>
          {message}
        </span>
      ) : null}
    </>
  );
}
