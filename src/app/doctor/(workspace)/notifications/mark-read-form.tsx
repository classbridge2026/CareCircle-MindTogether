"use client";

import { useActionState } from "react";
import { clearDoctorNotificationsAction, markDoctorNotificationRead, type NotificationActionState } from "./actions";

const initial: NotificationActionState = {};

export function ClearNotificationsForm() {
  const [state, action, pending] = useActionState(clearDoctorNotificationsAction, initial);
  return (
    <form action={action}>
      <button className="inline-flex h-10 items-center justify-center rounded-lg border-2 border-solid border-[#0b5f59] bg-[#0F766E] px-4 text-sm font-semibold text-white transition hover:border-[#084842] hover:bg-[#0b5f59] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F766E]" disabled={pending} type="submit">
        {pending ? "Clearing…" : "Clear notifications"}
      </button>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}

export function MarkReadForm({ notificationId }: { notificationId: string }) {
  const [state, action, pending] = useActionState(markDoctorNotificationRead, initial);
  return (
    <form action={action}>
      <input name="notificationId" type="hidden" value={notificationId} />
      <button className="notify-tap text-sm font-semibold text-[#0F766E]" disabled={pending} type="submit">{pending ? "Saving…" : "Mark read"}</button>
      {state.message ? <p className="sr-only" role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}
