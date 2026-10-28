"use client";

import { Fragment, useActionState } from "react";
import { StatusBadge, verificationBadge } from "@/components/status-badge";
import { updateOfferingFeeAction, updateServiceFeeAction, type PricingActionState } from "./actions";

const initial: PricingActionState = {};

export type PricingOffering = {
  id: string;
  doctorName: string;
  fee: string;
  currency: string;
  isActive: boolean;
  mode: "ONLINE" | "IN_PERSON";
  sameAsDefault: boolean;
  verificationStatus: string;
};

export type PricingService = {
  id: string;
  name: string;
  defaultFee: string;
  currency: string;
  isActive: boolean;
  mode: string | null;
  offerings: PricingOffering[];
};

function visitLabel(mode: string | null) {
  if (mode === "ONLINE") return "Online";
  if (mode === "IN_PERSON") return "In person";
  return "Either";
}

function FeeMessage({ state }: { state: PricingActionState }) {
  if (!state.message) return null;
  return (
    <span className={`fee-message${state.tone === "error" ? " is-error" : " is-ok"}`} role={state.tone === "error" ? "alert" : "status"}>
      {state.message}
    </span>
  );
}

function ServiceFeeRow({ service }: { service: PricingService }) {
  const formId = `service-fee-${service.id}`;
  const [state, action, pending] = useActionState(updateServiceFeeAction, initial);
  return (
    <tr className="fee-row-service">
      <td data-label="Service">
        <form id={formId} action={action}>
          <input type="hidden" name="id" value={service.id} />
        </form>
        <span className="users-cell">
          <span className="fee-name">{service.name}</span>
          <span className="users-sub">Default fee</span>
          <FeeMessage state={state} />
        </span>
      </td>
      <td data-label="Visit">
        <span className="users-cell">{visitLabel(service.mode)}</span>
      </td>
      <td data-label="Status">
        <span className="users-cell">
          <StatusBadge tone={service.isActive ? "teal" : "slate"}>{service.isActive ? "Active" : "Inactive"}</StatusBadge>
        </span>
      </td>
      <td data-label="Amount">
        <input
          form={formId}
          name="defaultFee"
          required
          defaultValue={service.defaultFee}
          inputMode="decimal"
          aria-label={`${service.name} default fee`}
          className="fee-field"
        />
      </td>
      <td data-label="Currency">
        <input
          form={formId}
          name="currency"
          required
          maxLength={3}
          defaultValue={service.currency}
          aria-label={`${service.name} currency`}
          className="fee-field fee-currency"
        />
      </td>
      <td data-label="Save">
        <button form={formId} className="fee-save" disabled={pending} type="submit">
          {pending ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
}

function OfferingFeeRow({ offering }: { offering: PricingOffering }) {
  const formId = `offering-fee-${offering.id}`;
  const [state, action, pending] = useActionState(updateOfferingFeeAction, initial);
  const verification = verificationBadge(offering.verificationStatus);
  return (
    <tr className="fee-row-doctor">
      <td data-label="Doctor">
        <form id={formId} action={action}>
          <input type="hidden" name="id" value={offering.id} />
        </form>
        <span className="users-cell">
          <span className="fee-doctor">{offering.doctorName}</span>
          <span className="users-sub">{offering.sameAsDefault ? "Same as the default" : "Different from the default"}</span>
          <FeeMessage state={state} />
        </span>
      </td>
      <td data-label="Visit">
        <span className="users-cell">{offering.mode === "ONLINE" ? "Online" : "In person"}</span>
      </td>
      <td data-label="Status">
        <span className="users-cell">
          <StatusBadge tone={offering.isActive ? "teal" : "slate"}>{offering.isActive ? "Active" : "Inactive"}</StatusBadge>
          <span className="users-sub">{verification.label}</span>
        </span>
      </td>
      <td data-label="Amount">
        <input
          form={formId}
          name="fee"
          required
          defaultValue={offering.fee}
          inputMode="decimal"
          aria-label={`${offering.doctorName} fee`}
          className="fee-field"
        />
      </td>
      <td data-label="Currency">
        <input
          form={formId}
          name="currency"
          required
          maxLength={3}
          defaultValue={offering.currency}
          aria-label={`${offering.doctorName} currency`}
          className="fee-field fee-currency"
        />
      </td>
      <td data-label="Save">
        <button form={formId} className="fee-save" disabled={pending} type="submit" aria-label={`Save ${offering.doctorName} fee`}>
          {pending ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
}

export function FeeSchedule({ services, currency }: { services: PricingService[]; currency: string }) {
  return (
    <section className="users-card">
      <header className="users-card-head">
        <h2>Fee schedule</h2>
        <span className="fee-currency-chip">Default {currency}</span>
      </header>
      <p className="fee-schedule-note">
        Set the default fee for a service, then a doctor’s own price underneath it. Amounts already stored on appointments stay as they are.
      </p>
      {services.length === 0 ? (
        <p className="users-empty">No services match these filters.</p>
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <caption className="sr-only">Fees and pricing</caption>
            <colgroup>
              <col className="fee-col-service" />
              <col className="fee-col-visit" />
              <col className="fee-col-status" />
              <col className="fee-col-amount" />
              <col className="fee-col-currency" />
              <col className="fee-col-save" />
            </colgroup>
            <thead>
              <tr>
                <th>Service</th>
                <th>Visit</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>Save</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <Fragment key={service.id}>
                  <ServiceFeeRow service={service} />
                  {service.offerings.length === 0 ? (
                    <tr className="fee-row-doctor">
                      <td colSpan={6} data-label="Doctors">
                        <span className="users-sub">No doctor has a price for this service yet.</span>
                      </td>
                    </tr>
                  ) : (
                    service.offerings.map((offering) => <OfferingFeeRow key={offering.id} offering={offering} />)
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
