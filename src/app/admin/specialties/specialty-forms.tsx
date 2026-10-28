"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "@/components/admin/admin-icons";
import { StatusBadge, verificationBadge } from "@/components/status-badge";
import { createSpecialtyAction, deleteSpecialtyAction, updateSpecialtyAction, type SpecialtyActionState } from "./actions";

const initial: SpecialtyActionState = {};

export type SpecialtyRecord = {
  id: string;
  code: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  referenced: boolean;
  doctorCount: number;
  offeringCount: number;
  appointmentCount: number;
  doctors: Array<{
    id: string;
    doctorId: string;
    fullName: string;
    claimStatus: string;
    isPrimary: boolean;
    verificationStatus: string;
  }>;
};

type Panel =
  | { kind: "create" }
  | { kind: "view"; specialty: SpecialtyRecord }
  | { kind: "edit"; specialty: SpecialtyRecord }
  | { kind: "delete"; specialty: SpecialtyRecord }
  | null;

function claimLabel(status: string) {
  if (status === "VERIFIED") return "Verified";
  if (status === "REJECTED") return "Rejected";
  return "Declared";
}

function usageLabel(specialty: SpecialtyRecord) {
  const doctors = `${specialty.doctorCount} doctor${specialty.doctorCount === 1 ? "" : "s"}`;
  const offerings = `${specialty.offeringCount} offering${specialty.offeringCount === 1 ? "" : "s"}`;
  const appointments = `${specialty.appointmentCount} appointment${specialty.appointmentCount === 1 ? "" : "s"}`;
  return `${doctors} · ${offerings} · ${appointments}`;
}

export function SpecialtiesBoard({ specialties }: { specialties: SpecialtyRecord[] }) {
  const [panel, setPanel] = useState<Panel>(null);
  const close = useCallback(() => setPanel(null), []);

  return (
    <section className="users-card">
      <header className="users-card-head">
        <h2>Specialties</h2>
        <button type="button" className="users-add" onClick={() => setPanel({ kind: "create" })}>
          <AdminIcon name="plus" />
          New specialty
        </button>
      </header>
      {specialties.length === 0 ? (
        <p className="users-empty">No specialties match these filters. Add a specialty to open it for doctors.</p>
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <caption className="sr-only">Specialties</caption>
            <colgroup>
              <col className="specialties-col-name" />
              <col className="specialties-col-doctors" />
              <col className="specialties-col-order" />
              <col className="specialties-col-status" />
              <col className="specialties-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Specialty</th>
                <th>Doctors</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {specialties.map((specialty) => (
                <tr key={specialty.id}>
                  <td data-label="Specialty">
                    <span className="users-cell">
                      <button type="button" className="users-email" onClick={() => setPanel({ kind: "view", specialty })}>
                        {specialty.name}
                      </button>
                      <span className="users-sub">{specialty.slug}</span>
                    </span>
                  </td>
                  <td data-label="Doctors">
                    <span className="users-cell">{specialty.doctorCount}</span>
                  </td>
                  <td data-label="Order">
                    <span className="users-cell">{specialty.sortOrder}</span>
                  </td>
                  <td data-label="Status">
                    <span className="users-cell">
                      <StatusBadge tone={specialty.isActive ? "teal" : "slate"}>{specialty.isActive ? "Active" : "Inactive"}</StatusBadge>
                    </span>
                  </td>
                  <td data-label="Actions">
                    <span className="users-cell">
                      <div className="user-actions">
                        <button type="button" className="user-icon-btn" aria-label={`View ${specialty.name}`} onClick={() => setPanel({ kind: "view", specialty })}>
                          <AdminIcon name="view" />
                        </button>
                        <button type="button" className="user-icon-btn" aria-label={`Edit ${specialty.name}`} onClick={() => setPanel({ kind: "edit", specialty })}>
                          <AdminIcon name="edit" />
                        </button>
                        <button type="button" className="user-icon-btn user-icon-btn-danger" aria-label={`Delete ${specialty.name}`} onClick={() => setPanel({ kind: "delete", specialty })}>
                          <AdminIcon name="trash" />
                        </button>
                      </div>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {panel?.kind === "create" ? <CreateDialog onClose={close} /> : null}
      {panel?.kind === "view" ? (
        <ViewDialog specialty={panel.specialty} onClose={close} onEdit={(specialty) => setPanel({ kind: "edit", specialty })} onDelete={(specialty) => setPanel({ kind: "delete", specialty })} />
      ) : null}
      {panel?.kind === "edit" ? <EditDialog specialty={panel.specialty} onClose={close} /> : null}
      {panel?.kind === "delete" ? <DeleteDialog specialty={panel.specialty} onClose={close} onEdit={(specialty) => setPanel({ kind: "edit", specialty })} /> : null}
    </section>
  );
}

function FormMessage({ state }: { state: SpecialtyActionState }) {
  if (!state.message) return null;
  return (
    <p className={state.tone === "error" ? "user-form-error" : "user-form-ok"} role={state.tone === "error" ? "alert" : "status"}>
      {state.message}
    </p>
  );
}

function useCloseOnSuccess(state: SpecialtyActionState, onClose: () => void) {
  const router = useRouter();
  useEffect(() => {
    if (state.tone !== "ok") return;
    router.refresh();
    onClose();
  }, [onClose, router, state]);
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(createSpecialtyAction, initial);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title="New specialty" onClose={onClose}>
      <form action={action} className="user-form">
        <div className="service-fields service-fields-2">
          <label>
            Name
            <input name="name" required maxLength={80} />
          </label>
          <label>
            Slug
            <input name="slug" required maxLength={60} placeholder="cardiology" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </label>
        </div>
        <p className="user-form-note">Use lowercase letters, numbers, and hyphens. The slug stays fixed after the specialty is created.</p>
        <label>
          Description
          <textarea name="description" maxLength={2000} />
        </label>
        <FormMessage state={state} />
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="users-add" disabled={pending}>
            {pending ? "Saving…" : "Create specialty"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ViewDialog({
  specialty,
  onClose,
  onEdit,
  onDelete,
}: {
  specialty: SpecialtyRecord;
  onClose: () => void;
  onEdit: (specialty: SpecialtyRecord) => void;
  onDelete: (specialty: SpecialtyRecord) => void;
}) {
  return (
    <Modal title="Specialty details" onClose={onClose} wide>
      <div className="user-view">
        <div>
          <p className="user-view-email">{specialty.name}</p>
          <p className="user-view-role">
            {specialty.code} · {specialty.slug}
          </p>
        </div>
        <dl className="user-view-grid">
          <div>
            <dt>Status</dt>
            <dd>
              <StatusBadge tone={specialty.isActive ? "teal" : "slate"}>{specialty.isActive ? "Active" : "Inactive"}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>Display order</dt>
            <dd>{specialty.sortOrder}</dd>
          </div>
          <div>
            <dt>Usage</dt>
            <dd>{usageLabel(specialty)}</dd>
          </div>
        </dl>
        <section className="user-view-section">
          <h3>Description</h3>
          <p className="user-form-note">{specialty.description || "No description is saved."}</p>
        </section>
        <section className="user-view-section">
          <h3>Doctors ({specialty.doctorCount})</h3>
          {specialty.doctors.length === 0 ? (
            <p className="user-form-note">No doctors are associated with this specialty.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {specialty.doctors.map((doctor) => {
                const verification = verificationBadge(doctor.verificationStatus);
                return (
                  <li key={doctor.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <Link href={`/admin/doctors/${doctor.doctorId}`} className="font-medium text-brand-navy underline-offset-2 hover:underline">
                      {doctor.fullName}
                      {doctor.isPrimary ? " · primary" : ""}
                    </Link>
                    <span className="flex flex-wrap gap-2">
                      <StatusBadge tone={doctor.claimStatus === "VERIFIED" ? "teal" : doctor.claimStatus === "REJECTED" ? "red" : "amber"}>
                        {claimLabel(doctor.claimStatus)}
                      </StatusBadge>
                      <StatusBadge tone={verification.tone}>{verification.label}</StatusBadge>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {specialty.doctorCount > specialty.doctors.length ? (
            <p className="user-form-note">Showing the first {specialty.doctors.length} doctors.</p>
          ) : null}
        </section>
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Close
          </button>
          <button type="button" className="users-cancel" onClick={() => onDelete(specialty)}>
            Delete
          </button>
          <button type="button" className="users-add" onClick={() => onEdit(specialty)}>
            Edit specialty
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditDialog({ specialty, onClose }: { specialty: SpecialtyRecord; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateSpecialtyAction, initial);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title={`Edit ${specialty.name}`} onClose={onClose}>
      <form action={action} className="user-form">
        <input type="hidden" name="id" value={specialty.id} />
        <label>
          Name
          <input name="name" required maxLength={80} defaultValue={specialty.name} />
        </label>
        <p className="user-form-note">Slug {specialty.slug}. It stays fixed so existing links keep working.</p>
        <label>
          Description
          <textarea name="description" maxLength={2000} defaultValue={specialty.description ?? ""} />
        </label>
        <label>
          Display order
          <input name="sortOrder" type="number" min={0} max={999} required defaultValue={specialty.sortOrder} />
        </label>
        <label className="service-check">
          <input name="isActive" type="checkbox" defaultChecked={specialty.isActive} />
          Active for new doctor claims
        </label>
        <FormMessage state={state} />
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="users-add" disabled={pending}>
            {pending ? "Saving…" : "Save specialty"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({
  specialty,
  onClose,
  onEdit,
}: {
  specialty: SpecialtyRecord;
  onClose: () => void;
  onEdit: (specialty: SpecialtyRecord) => void;
}) {
  const [state, action, pending] = useActionState(deleteSpecialtyAction, initial);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title="Delete specialty" onClose={onClose}>
      <form action={action} className="user-form">
        <input type="hidden" name="id" value={specialty.id} />
        <p className="user-form-note">
          {specialty.referenced
            ? `${specialty.name} is already used (${usageLabel(specialty)}). Deactivate it so existing doctors and appointments stay unchanged.`
            : `Delete ${specialty.name}? This removes it from the catalog.`}
        </p>
        <FormMessage state={state} />
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Cancel
          </button>
          {specialty.referenced ? (
            <button type="button" className="users-add" onClick={() => onEdit(specialty)}>
              Edit specialty
            </button>
          ) : (
            <button type="submit" className="users-delete" disabled={pending}>
              {pending ? "Deleting…" : "Delete specialty"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, wide = false, children }: { title: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="user-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className={wide ? "user-modal user-modal-wide" : "user-modal"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="specialty-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="user-modal-head">
          <h2 id="specialty-dialog-title">{title}</h2>
          <button type="button" className="user-icon-btn" aria-label="Close" onClick={onClose}>
            <AdminIcon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
