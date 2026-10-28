"use client";

import { useActionState } from "react";
import { secondaryButtonClass } from "@/components/form-classes";
import type { AdminActionState } from "@/lib/admin/action-state";
import { clearNotificationsAction, markAllReadAction, markReadAction } from "./actions";

const initial: AdminActionState = {};

export function MarkReadForm({ notificationId }: { notificationId: string }) {
  const [state, action, pending] = useActionState(markReadAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="notificationId" value={notificationId} />
      <button className="text-sm font-semibold text-brand-teal" disabled={pending} type="submit">
        {pending ? "Saving…" : "Mark read"}
      </button>
      {state.message ? <span className="sr-only">{state.message}</span> : null}
    </form>
  );
}

export function ClearNotificationsForm() {
  const [state, action, pending] = useActionState(clearNotificationsAction, initial);
  return (
    <form action={action} className="grid gap-2">
      <button className="inline-flex h-10 items-center justify-center rounded-lg border-2 border-solid border-[#0b5f59] bg-brand-teal px-4 text-sm font-semibold text-white transition hover:border-[#084842] hover:bg-brand-teal-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal" disabled={pending} type="submit">
        {pending ? "Clearing…" : "Clear notifications"}
      </button>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}

export function MarkAllReadForm() {
  const [state, action, pending] = useActionState(markAllReadAction, initial);
  return (
    <form action={action} className="grid gap-2">
      <button className={secondaryButtonClass} disabled={pending} type="submit">
        {pending ? "Saving…" : "Mark all read"}
      </button>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}
