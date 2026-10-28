"use client";

import { useActionState } from "react";
import { dangerButtonClass, primaryButtonClass, textAreaClass } from "@/components/form-classes";
import { reviewCredentialAction, type AdminActionState } from "../../../actions";

const initial: AdminActionState = {};

export function ReviewForm({ credentialId, doctorId }: { credentialId: string; doctorId: string }) {
  const [state, action, pending] = useActionState(reviewCredentialAction, initial);
  return (
    <form action={action} className="grid max-w-xl gap-3">
      <input type="hidden" name="credentialId" value={credentialId} />
      <input type="hidden" name="doctorProfileId" value={doctorId} />
      <label className="text-sm font-medium" htmlFor="review-notes">
        Review notes
      </label>
      <textarea id="review-notes" name="notes" className={textAreaClass} />
      {state.message ? (
        <p role={state.tone === "error" ? "alert" : "status"} className="text-sm">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button className={primaryButtonClass} name="decision" value="VERIFIED" disabled={pending} type="submit">
          {pending ? "Saving…" : "Verify document"}
        </button>
        <button className={dangerButtonClass} name="decision" value="REJECTED" disabled={pending} type="submit">
          Reject document
        </button>
      </div>
    </form>
  );
}
