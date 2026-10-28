"use client";

import { useActionState } from "react";
import { COUNTRIES } from "@/lib/catalog/countries";
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass, textAreaClass, textInputClass } from "@/components/form-classes";
import { createLocationAction, deleteLocationAction, updateLocationAction, type LocationActionState } from "./actions";

const initial: LocationActionState = {};

function CountryField({ defaultValue }: { defaultValue?: string }) {
  const known = COUNTRIES.some((country) => country.code === defaultValue);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">
        Country
        <select name="countryCode" defaultValue={known || !defaultValue ? defaultValue || "SL" : "OTHER"} className={`${textInputClass} mt-1`}>
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
          <option value="OTHER">Other country code</option>
        </select>
      </label>
      <label className="text-sm font-medium">
        Other ISO code
        <input name="countryCodeOther" defaultValue={known || !defaultValue ? "" : defaultValue} maxLength={2} className={`${textInputClass} mt-1`} placeholder="Used when Other is selected" />
      </label>
    </div>
  );
}

function LocationFields({
  location,
  systemName,
}: {
  systemName: string;
  location?: {
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    locality: string;
    district: string;
    countryCode: string;
    phone: string | null;
    latitude: string;
    longitude: string;
    accessInstructions: string | null;
  };
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">
          Location name
          <input name="name" required defaultValue={location?.name} className={`${textInputClass} mt-1`} />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Address
          <input name="addressLine1" required defaultValue={location?.addressLine1} className={`${textInputClass} mt-1`} />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Address line 2
          <input name="addressLine2" defaultValue={location?.addressLine2 ?? ""} className={`${textInputClass} mt-1`} />
        </label>
        <label className="text-sm font-medium">
          City or town
          <input name="locality" required defaultValue={location?.locality} className={`${textInputClass} mt-1`} />
        </label>
        <label className="text-sm font-medium">
          District
          <input name="district" required defaultValue={location?.district} className={`${textInputClass} mt-1`} />
        </label>
      </div>
      <CountryField defaultValue={location?.countryCode} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">
          Contact phone
          <input name="phone" defaultValue={location?.phone ?? ""} className={`${textInputClass} mt-1`} />
        </label>
        <label className="text-sm font-medium">
          Latitude
          <input name="latitude" defaultValue={location?.latitude ?? ""} inputMode="decimal" className={`${textInputClass} mt-1`} />
        </label>
        <label className="text-sm font-medium">
          Longitude
          <input name="longitude" defaultValue={location?.longitude ?? ""} inputMode="decimal" className={`${textInputClass} mt-1`} />
        </label>
      </div>
      <p className="text-xs leading-5 text-brand-muted">Coordinates are stored as entered. {systemName} does not verify the address or show a map.</p>
      <label className="text-sm font-medium">
        Accessibility or visit instructions
        <textarea name="accessInstructions" defaultValue={location?.accessInstructions ?? ""} className={`${textAreaClass} mt-1`} />
      </label>
    </>
  );
}

export function CreateLocationForm({ systemName }: { systemName: string }) {
  const [state, action, pending] = useActionState(createLocationAction, initial);
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-navy">Add a {systemName} location</h2>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
      <LocationFields systemName={systemName} />
      <button className={primaryButtonClass} disabled={pending} type="submit">
        {pending ? "Saving…" : "Create location"}
      </button>
    </form>
  );
}

export function LocationEditor({
  location,
  systemName,
}: {
  systemName: string;
  location: {
    id: string;
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    locality: string;
    district: string;
    countryCode: string;
    phone: string | null;
    latitude: string;
    longitude: string;
    accessInstructions: string | null;
    isActive: boolean;
    referenced: boolean;
    countryLabel: string;
  };
}) {
  const [state, action, pending] = useActionState(updateLocationAction, initial);
  const [removeState, remove, removePending] = useActionState(deleteLocationAction, initial);
  return (
    <article className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-brand-navy">{location.name}</h2>
        <span className="text-xs font-semibold tracking-wide text-brand-muted uppercase">{location.isActive ? "Active" : "Inactive"}</span>
      </div>
      <p className="text-sm text-brand-muted">
        {location.locality}, {location.district}, {location.countryLabel}
      </p>
      <form action={action} className="grid gap-3">
        <input type="hidden" name="id" value={location.id} />
        <LocationFields location={location} systemName={systemName} />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input name="isActive" type="checkbox" defaultChecked={location.isActive} />
          Active for new appointments
        </label>
        <button className={secondaryButtonClass} disabled={pending} type="submit">
          {pending ? "Saving…" : "Save location"}
        </button>
        {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
      </form>
      <form action={remove}>
        <input type="hidden" name="id" value={location.id} />
        <button className={dangerButtonClass} disabled={removePending || location.referenced} type="submit">
          {removePending ? "Checking…" : "Delete location"}
        </button>
        {location.referenced ? (
          <p className="mt-2 text-xs leading-5 text-brand-muted">This location is already used. Deactivate it so historical appointments keep the address.</p>
        ) : null}
        {removeState.message ? (
          <p className="mt-2 text-sm" role={removeState.tone === "error" ? "alert" : "status"}>
            {removeState.message}
          </p>
        ) : null}
      </form>
    </article>
  );
}
