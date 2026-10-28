"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "@/components/admin/admin-icons";
import { primaryButtonClass, textInputClass } from "@/components/form-classes";
import type { AdminActionState } from "@/lib/admin/action-state";
import { saveSupportContactAction } from "./actions";

const initial: AdminActionState = {};

export function SupportContactForm({ region, serviceName, phone }: { region: string; serviceName: string; phone: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveSupportContactAction, initial);
  const wasPending = useRef(false);
  const saved = serviceName.length > 0 && phone.length > 0;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (wasPending.current && !pending && state.tone === "ok") {
      setOpen(false);
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, router, state.tone]);

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-line bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-brand-navy">Support contact</h2>
        <p className="mt-1 text-sm leading-6 text-brand-muted">
          {saved
            ? `${serviceName} · ${phone} · ${region}`
            : "No service name or phone number is saved. Patients see this only after a safety flag."}
        </p>
      </div>
      <button className={primaryButtonClass} type="button" onClick={() => setOpen(true)}>
        {saved ? "Edit support contact" : "Set support contact"}
      </button>
      {open ? (
        <div className="user-modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <div
            className="user-modal screen-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-contact-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="screen-dialog-head">
              <div>
                <p className="screen-dialog-kicker">Screening</p>
                <h2 id="support-contact-title">Support contact</h2>
                <p className="screen-dialog-purpose">
                  Enter a service patients can call if a depression answer suggests they may harm themselves. Saving this does not approve a screen.
                </p>
              </div>
              <button className="screen-dialog-close" type="button" aria-label="Close" onClick={() => setOpen(false)}>
                <AdminIcon name="close" />
              </button>
            </header>
            <form action={action} className="screen-dialog-body grid gap-3" key={`${region}|${serviceName}|${phone}`}>
              <label className="text-sm font-medium">
                Area this number covers
                <input name="region" required minLength={2} maxLength={80} defaultValue={region} placeholder="Freetown" className={`${textInputClass} mt-1`} />
              </label>
              <label className="text-sm font-medium">
                Service name
                <input name="serviceName" required minLength={2} maxLength={80} defaultValue={serviceName} className={`${textInputClass} mt-1`} />
              </label>
              <label className="text-sm font-medium">
                Phone number
                <input name="phone" required inputMode="tel" autoComplete="tel" maxLength={80} defaultValue={phone} className={`${textInputClass} mt-1`} />
              </label>
              {state.tone === "error" && state.message ? <p role="alert" className="text-sm text-brand-danger">{state.message}</p> : null}
              <button className={primaryButtonClass} disabled={pending} type="submit">
                {pending ? "Saving…" : "Save support contact"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
