"use client";

import { useActionState, useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "@/components/admin/admin-icons";
import { StatusBadge } from "@/components/status-badge";
import { COUNTRIES } from "@/lib/catalog/countries";
import type { VerifiedPlace } from "@/lib/catalog/geocode";
import { createLocationAction, deleteLocationAction, updateLocationAction, verifyLocationAction, type LocationActionState } from "./actions";

const initial: LocationActionState = {};

export type LocationRecord = {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  locality: string;
  district: string;
  countryCode: string;
  countryLabel: string;
  phone: string | null;
  latitude: string;
  longitude: string;
  accessInstructions: string | null;
  isActive: boolean;
  referenced: boolean;
};

type Panel = { kind: "create" } | { kind: "view"; location: LocationRecord } | { kind: "edit"; location: LocationRecord } | { kind: "delete"; location: LocationRecord } | null;

function storedPlace(location: LocationRecord): VerifiedPlace | null {
  if (!location.latitude || !location.longitude) return null;
  return {
    id: location.id,
    title: location.locality,
    detail: location.countryLabel,
    addressLine1: location.addressLine1,
    district: location.district,
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

export function LocationsBoard({ locations, systemName }: { locations: LocationRecord[]; systemName: string }) {
  const [panel, setPanel] = useState<Panel>(null);
  const close = useCallback(() => setPanel(null), []);

  return (
    <section className="users-card locations-board">
      <header className="users-card-head">
        <h2>Locations</h2>
        <button type="button" className="users-add" onClick={() => setPanel({ kind: "create" })}>
          <AdminIcon name="plus" />
          New location
        </button>
      </header>
      {locations.length === 0 ? (
        <p className="users-empty">No locations match these filters.</p>
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <caption className="sr-only">Locations</caption>
            <colgroup>
              <col className="locations-col-name" />
              <col className="locations-col-country" />
              <col className="locations-col-phone" />
              <col className="locations-col-status" />
              <col className="locations-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Location</th>
                <th>Country</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => {
                const onMap = Boolean(location.latitude && location.longitude);
                return (
                  <tr key={location.id}>
                    <td className="location-main" data-label="Location">
                      <span className="users-cell">
                        <button type="button" className="users-email" onClick={() => setPanel({ kind: "view", location })}>
                          {location.name}
                        </button>
                        <span className="location-place">
                          <AdminIcon name="location" />
                          {location.locality}
                        </span>
                        <StatusBadge tone={onMap ? "teal" : "amber"}>{onMap ? "On the map" : "Not on the map"}</StatusBadge>
                      </span>
                    </td>
                    <td className="location-meta" data-label="Country">
                      <span className="location-chip">{location.countryLabel}</span>
                    </td>
                    <td className="location-meta" data-label="Phone">
                      <span className="location-chip">{location.phone || "No phone"}</span>
                    </td>
                    <td className="location-meta" data-label="Status">
                      <StatusBadge tone={location.isActive ? "teal" : "slate"}>{location.isActive ? "Active" : "Inactive"}</StatusBadge>
                    </td>
                    <td className="location-actions" data-label="Actions">
                      <div className="user-actions">
                        <button type="button" className="user-icon-btn" aria-label={`View ${location.name}`} onClick={() => setPanel({ kind: "view", location })}>
                          <AdminIcon name="view" />
                        </button>
                        <button type="button" className="user-icon-btn" aria-label={`Edit ${location.name}`} onClick={() => setPanel({ kind: "edit", location })}>
                          <AdminIcon name="edit" />
                        </button>
                        <button type="button" className="user-icon-btn user-icon-btn-danger" aria-label={`Delete ${location.name}`} onClick={() => setPanel({ kind: "delete", location })}>
                          <AdminIcon name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {panel?.kind === "create" ? <LocationDialog mode="create" systemName={systemName} onClose={close} /> : null}
      {panel?.kind === "edit" ? <LocationDialog mode="edit" systemName={systemName} location={panel.location} onClose={close} /> : null}
      {panel?.kind === "view" ? (
        <ViewDialog
          location={panel.location}
          systemName={systemName}
          onClose={close}
          onEdit={() => setPanel({ kind: "edit", location: panel.location })}
          onDelete={() => setPanel({ kind: "delete", location: panel.location })}
        />
      ) : null}
      {panel?.kind === "delete" ? <DeleteDialog location={panel.location} onClose={close} onEdit={() => setPanel({ kind: "edit", location: panel.location })} /> : null}
    </section>
  );
}

function LocationMap({ place, title }: { place: VerifiedPlace; title: string }) {
  const lat = Number(place.latitude);
  const lng = Number(place.longitude);
  const pad = 0.012;
  const bbox = [lng - pad, lat - pad, lng + pad, lat + pad].map((value) => value.toFixed(6)).join("%2C");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${encodeURIComponent(place.latitude)}%2C${encodeURIComponent(place.longitude)}`;
  const open = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(place.latitude)}&mlon=${encodeURIComponent(place.longitude)}#map=16/${encodeURIComponent(place.latitude)}/${encodeURIComponent(place.longitude)}`;
  return (
    <figure className="location-map-frame">
      <iframe title={title} src={src} loading="lazy" />
      <figcaption>
        <a href={open} target="_blank" rel="noreferrer">
          Open the map
        </a>
        <span>Map data © OpenStreetMap</span>
      </figcaption>
    </figure>
  );
}

function CountrySelect({ countryCode }: { countryCode?: string }) {
  const known = COUNTRIES.some((country) => country.code === countryCode);
  return (
    <label>
      Country
      <select name="countryCode" defaultValue={known || !countryCode ? countryCode || "SL" : countryCode}>
        {COUNTRIES.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
        {!known && countryCode ? <option value={countryCode}>{countryCode}</option> : null}
      </select>
    </label>
  );
}

function PlaceCheck({
  systemName,
  location,
  resetToken,
  onPlace,
}: {
  systemName: string;
  location?: LocationRecord;
  resetToken: number;
  onPlace: (place: VerifiedPlace | null) => void;
}) {
  const [places, setPlaces] = useState<VerifiedPlace[]>([]);
  const [selected, setSelected] = useState<VerifiedPlace | null>(location ? storedPlace(location) : null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "note">("error");

  useEffect(() => {
    if (resetToken === 0) return;
    setPlaces([]);
    setSelected(null);
    setMessage("Verify the address again so the map matches the name and city.");
    setMessageTone("note");
    onPlace(null);
  }, [onPlace, resetToken]);

  function choose(place: VerifiedPlace | null) {
    setSelected(place);
    onPlace(place);
  }

  async function verify(form: HTMLFormElement) {
    const data = new FormData(form);
    setPending(true);
    setMessage("");
    setMessageTone("error");
    choose(null);
    const result = await verifyLocationAction({
      name: String(data.get("name") ?? ""),
      locality: String(data.get("locality") ?? ""),
      countryCode: String(data.get("countryCode") ?? ""),
    });
    setPending(false);
    if (!result.ok) {
      setPlaces([]);
      setMessage(result.message);
      return;
    }
    setPlaces(result.places);
    if (result.places[0]) choose(result.places[0]);
  }

  return (
    <div className="location-check">
      <button
        type="button"
        className="users-add location-verify"
        disabled={pending}
        onClick={(event) => {
          const form = event.currentTarget.form;
          if (form) void verify(form);
        }}
      >
        <AdminIcon name="location" />
        {pending ? "Checking the map…" : "Verify address"}
      </button>
      <p className="user-form-note">{systemName} checks this place and shows it on the map. Change the name or city, then verify again.</p>
      {message ? (
        <p className={messageTone === "error" ? "user-form-error" : "user-form-note"} role={messageTone === "error" ? "alert" : "status"}>
          {message}
        </p>
      ) : null}
      {places.length > 1 ? (
        <div className="location-matches" role="list">
          {places.map((place) => (
            <button key={place.id} type="button" className={`location-match${selected?.id === place.id ? " is-selected" : ""}`} onClick={() => choose(place)}>
              <strong>{place.title}</strong>
              {place.detail ? <span>{place.detail}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {selected ? <LocationMap place={selected} title={`Map of ${selected.title}`} /> : null}
      <input type="hidden" name="addressLine1" value={selected?.addressLine1 ?? ""} />
      <input type="hidden" name="addressLine2" value="" />
      <input type="hidden" name="district" value={selected?.district ?? ""} />
      <input type="hidden" name="latitude" value={selected?.latitude ?? ""} />
      <input type="hidden" name="longitude" value={selected?.longitude ?? ""} />
    </div>
  );
}

function LocationDialog({
  mode,
  systemName,
  location,
  onClose,
}: {
  mode: "create" | "edit";
  systemName: string;
  location?: LocationRecord;
  onClose: () => void;
}) {
  const actionFn = mode === "create" ? createLocationAction : updateLocationAction;
  const [state, action, pending] = useActionState(actionFn, initial);
  const [verified, setVerified] = useState(Boolean(location && storedPlace(location)));
  const [resetToken, setResetToken] = useState(0);
  const markPlace = useCallback((place: VerifiedPlace | null) => setVerified(Boolean(place)), []);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title={mode === "create" ? "New location" : `Edit ${location?.name}`} kicker={systemName} onClose={onClose}>
      <form action={action} className="user-form">
        {location ? <input type="hidden" name="id" value={location.id} /> : null}
        <div className="service-fields service-fields-2" onChange={() => setResetToken((token) => token + 1)}>
          <label>
            Location name
            <input name="name" required maxLength={120} defaultValue={location?.name} />
          </label>
          <label>
            City or town
            <input name="locality" required maxLength={80} defaultValue={location?.locality} />
          </label>
          <CountrySelect countryCode={location?.countryCode} />
        </div>
        <label>
          Contact phone
          <input name="phone" defaultValue={location?.phone ?? ""} inputMode="tel" autoComplete="tel" />
        </label>
        <PlaceCheck systemName={systemName} location={location} resetToken={resetToken} onPlace={markPlace} />
        <label>
          Visit instructions
          <textarea name="accessInstructions" maxLength={2000} defaultValue={location?.accessInstructions ?? ""} placeholder="Entrance, floor, or what to tell a patient" />
        </label>
        {mode === "edit" ? (
          <label className="service-check">
            <input name="isActive" type="checkbox" defaultChecked={location?.isActive} />
            Active for new appointments
          </label>
        ) : null}
        <FormMessage state={state} />
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="users-add" disabled={pending || !verified}>
            {pending ? "Saving…" : mode === "create" ? "Create location" : "Save location"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ViewDialog({
  location,
  systemName,
  onClose,
  onEdit,
  onDelete,
}: {
  location: LocationRecord;
  systemName: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const place = storedPlace(location);
  return (
    <Modal title={location.name} kicker={systemName} onClose={onClose} wide>
      <div className="user-view">
        {place ? <LocationMap place={place} title={`Map of ${location.name}`} /> : <p className="location-missing">This place is not on the map yet. Edit it and verify the address.</p>}
        <dl className="screen-facts">
          <div className="screen-fact">
            <dt>City</dt>
            <dd>{location.locality}</dd>
          </div>
          <div className="screen-fact">
            <dt>Country</dt>
            <dd>{location.countryLabel}</dd>
          </div>
          <div className="screen-fact">
            <dt>Phone</dt>
            <dd>{location.phone || "No phone saved"}</dd>
          </div>
          <div className="screen-fact">
            <dt>Status</dt>
            <dd>
              <StatusBadge tone={location.isActive ? "teal" : "slate"}>{location.isActive ? "Active" : "Inactive"}</StatusBadge>
            </dd>
          </div>
          <div className="screen-fact wide">
            <dt>Visit instructions</dt>
            <dd>{location.accessInstructions || "No visit instructions saved."}</dd>
          </div>
        </dl>
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Close
          </button>
          <button type="button" className="users-cancel" onClick={onDelete}>
            Delete
          </button>
          <button type="button" className="users-add" onClick={onEdit}>
            Edit location
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteDialog({ location, onClose, onEdit }: { location: LocationRecord; onClose: () => void; onEdit: () => void }) {
  const [state, action, pending] = useActionState(deleteLocationAction, initial);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title={`Delete ${location.name}`} onClose={onClose}>
      <form action={action} className="user-form">
        <input type="hidden" name="id" value={location.id} />
        {location.referenced ? (
          <p className="user-form-note">This location is already used. Deactivate it so appointments already booked keep the place.</p>
        ) : (
          <p className="user-form-note">This location is not used by an appointment. Deleting it cannot be undone.</p>
        )}
        <FormMessage state={state} />
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Cancel
          </button>
          {location.referenced ? (
            <button type="button" className="users-add" onClick={onEdit}>
              Edit location
            </button>
          ) : (
            <button type="submit" className="users-delete" disabled={pending}>
              {pending ? "Deleting…" : "Delete location"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function FormMessage({ state }: { state: LocationActionState }) {
  if (!state.message) return null;
  return (
    <p className={state.tone === "error" ? "user-form-error" : "user-form-ok"} role={state.tone === "error" ? "alert" : "status"}>
      {state.message}
    </p>
  );
}

function useCloseOnSuccess(state: LocationActionState, onClose: () => void) {
  const router = useRouter();
  useEffect(() => {
    if (state.tone !== "ok") return;
    router.refresh();
    onClose();
  }, [onClose, router, state]);
}

function Modal({ title, kicker, onClose, wide = false, children }: { title: string; kicker?: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="user-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className={`user-modal screen-dialog${wide ? " user-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="location-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="screen-dialog-head">
          <div>
            {kicker ? <p className="screen-dialog-kicker">{kicker}</p> : null}
            <h2 id="location-dialog-title">{title}</h2>
          </div>
          <button type="button" className="screen-dialog-close" aria-label="Close" onClick={onClose}>
            <AdminIcon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
