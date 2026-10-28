"use client";

import { useActionState } from "react";
import { secondaryButtonClass, textInputClass } from "@/components/form-classes";
import { updateOfferingFeeAction, updateServiceFeeAction, type PricingActionState } from "./actions";

const initial: PricingActionState = {};

export function ServiceFeeForm({
  service,
}: {
  service: { id: string; name: string; defaultFee: string; currency: string; isActive: boolean; mode: string | null };
}) {
  const [state, action, pending] = useActionState(updateServiceFeeAction, initial);
  const mode = service.mode === "ONLINE" ? "Online" : service.mode === "IN_PERSON" ? "In person" : "Online or in person";
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">{service.name}</h2>
          <p className="text-sm text-brand-muted">
            {mode} · {service.isActive ? "Active" : "Inactive"} · Default service fee
          </p>
        </div>
        <p className="text-sm font-semibold text-brand-navy">
          {service.defaultFee} {service.currency}
        </p>
      </div>
      <input type="hidden" name="id" value={service.id} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
        <label className="text-sm font-medium">
          Default fee
          <input name="defaultFee" required defaultValue={service.defaultFee} inputMode="decimal" className={`${textInputClass} mt-1`} />
        </label>
        <label className="text-sm font-medium">
          Currency
          <input name="currency" required maxLength={3} defaultValue={service.currency} className={`${textInputClass} mt-1`} />
        </label>
        <button className={secondaryButtonClass} disabled={pending} type="submit">
          {pending ? "Saving…" : "Save default"}
        </button>
      </div>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}

export function OfferingFeeForm({
  offering,
}: {
  offering: {
    id: string;
    doctorName: string;
    fee: string;
    currency: string;
    isActive: boolean;
    mode: "ONLINE" | "IN_PERSON";
    sameAsDefault: boolean;
    verificationStatus: string;
  };
}) {
  const [state, action, pending] = useActionState(updateOfferingFeeAction, initial);
  return (
    <form action={action} className="grid gap-3 border-t border-brand-line pt-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_8rem_auto] sm:items-end">
      <div>
        <p className="text-sm font-semibold text-brand-navy">{offering.doctorName}</p>
        <p className="text-xs text-brand-muted">
          Doctor price · {offering.mode === "ONLINE" ? "Online" : "In person"} · {offering.isActive ? "Active" : "Inactive"} · {offering.verificationStatus}
          {offering.sameAsDefault ? " · Same amount as the default" : " · Different from the default"}
        </p>
      </div>
      <input type="hidden" name="id" value={offering.id} />
      <label className="text-sm font-medium">
        Doctor fee
        <input name="fee" required defaultValue={offering.fee} inputMode="decimal" className={`${textInputClass} mt-1`} />
      </label>
      <label className="text-sm font-medium">
        Currency
        <input name="currency" required maxLength={3} defaultValue={offering.currency} className={`${textInputClass} mt-1`} />
      </label>
      <button className={secondaryButtonClass} disabled={pending} type="submit">
        {pending ? "Saving…" : "Save doctor price"}
      </button>
      {state.message ? (
        <p className="sm:col-span-4" role={state.tone === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
