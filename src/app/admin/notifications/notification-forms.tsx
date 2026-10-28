"use client";

import { useActionState } from "react";
import type { AdminActionState } from "@/lib/admin/action-state";
import { clearNotificationsAction, markAllReadAction, markReadAction } from "./actions";

const initial: AdminActionState = {};

export function MarkReadForm({ notificationId }: { notificationId: string }) {
  const [state, action, pending] = useActionState(markReadAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="notificationId" value={notificationId} />
      <button className="screen-action screen-action-view" disabled={pending} type="submit">
        {pending ? "Saving…" : "Read"}
      </button>
      {state.message ? <span className="sr-only">{state.message}</span> : null}
    </form>
  );
}

export function ClearNotificationsForm() {
  const [state, action, pending] = useActionState(clearNotificationsAction, initial);
  return (
    <form action={action} className="screen-action-form">
      <button className="screen-action screen-action-off" disabled={pending} type="submit">
        {pending ? "Clearing…" : "Clear"}
      </button>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}

export function MarkAllReadForm() {
  const [state, action, pending] = useActionState(markAllReadAction, initial);
  return (
    <form action={action} className="screen-action-form">
      <button className="screen-action screen-action-on" disabled={pending} type="submit">
        {pending ? "Saving…" : "Mark all read"}
      </button>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}
