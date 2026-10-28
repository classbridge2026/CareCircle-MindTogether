"use client";

import { useActionState } from "react";
import { primaryButtonClass } from "@/components/form-classes";
import type { AdminActionState } from "@/lib/admin/action-state";
import { processHoldsAction } from "./actions";

const initial: AdminActionState = {};

export function ProcessHoldsForm() {
  const [state, action, pending] = useActionState(processHoldsAction, initial);
  return (
    <form action={action} className="grid gap-3">
      <button className={primaryButtonClass} disabled={pending} type="submit">
        {pending ? "Processing…" : "Process expired holds"}
      </button>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}
