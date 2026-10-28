"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AdminIcon } from "@/components/admin/admin-icons";
import { StatusBadge } from "@/components/status-badge";
import type { AdminActionState } from "@/lib/admin/action-state";
import type { BadgeTone } from "@/lib/admin/labels";
import { ProfilePhoto } from "@/components/profile-photo";
import {
  createPatientAction,
  deletePatientAction,
  readPatientAccount,
  updatePatientAction,
  type PatientAccountView,
} from "./actions";

export type PatientRow = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  timezone: string;
  status: string;
  statusLabel: string;
  statusTone: BadgeTone;
  gender: string;
  dateOfBirth: string;
  nationality: string | null;
  residentialAddress: string | null;
  preferredLanguage: string | null;
  emergencyContactName: string | null;
  isDependent: boolean;
  appointments: number;
  createdLabel: string;
  canManage: boolean;
  imageVersion: string | null;
};

const initial: AdminActionState = {};
const statuses = [
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING_VERIFICATION", label: "Pending verification" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DISABLED", label: "Disabled" },
];
const genders = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

type Mode = { kind: "create" } | { kind: "view"; patientId: string } | { kind: "edit"; patient: PatientRow } | { kind: "delete"; patient: PatientRow } | null;

function rememberView(patientId: string | null) {
  const url = new URL(window.location.href);
  if (patientId) url.searchParams.set("view", patientId);
  else url.searchParams.delete("view");
  const next = `${url.pathname}${url.search}`;
  if (`${window.location.pathname}${window.location.search}` !== next) window.history.replaceState(null, "", next);
}

function genderLabel(value: string) {
  return genders.find((item) => item.value === value)?.label ?? value;
}

export function PatientsBoard({ rows, initialViewId = null }: { rows: PatientRow[]; initialViewId?: string | null }) {
  const [mode, setMode] = useState<Mode>(initialViewId ? { kind: "view", patientId: initialViewId } : null);

  function openView(patientId: string) {
    setMode({ kind: "view", patientId });
    rememberView(patientId);
  }

  function closeMode() {
    setMode(null);
    rememberView(null);
  }

  return (
    <section className="users-card">
      <header className="users-card-head">
        <h2>Patients</h2>
        <button type="button" className="users-add" onClick={() => setMode({ kind: "create" })}>
          <AdminIcon name="plus" />
          Add patient
        </button>
      </header>
      {rows.length === 0 ? (
        <p className="users-empty">No patient profiles match these filters.</p>
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <caption className="sr-only">Patients</caption>
            <colgroup>
              <col className="patient-col-name" />
              <col className="patient-col-account" />
              <col className="patient-col-count" />
              <col className="patient-col-date" />
              <col className="users-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Account</th>
                <th>Appointments</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((patient) => (
                <tr key={patient.id}>
                  <td data-label="Patient">
                    <span className="users-cell">
                      <span className="users-person">
                        <ProfilePhoto userId={patient.userId} name={patient.fullName} version={patient.imageVersion} size={36} />
                        <span>
                          <button type="button" className="users-email" onClick={() => openView(patient.id)}>
                            {patient.fullName}
                          </button>
                          <span className="users-sub">{patient.email}</span>
                          {patient.isDependent ? <span className="users-sub">Dependent profile</span> : null}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Account">
                    <span className="users-cell">
                      <StatusBadge tone={patient.statusTone}>{patient.statusLabel}</StatusBadge>
                    </span>
                  </td>
                  <td data-label="Appointments">
                    <span className="users-cell">{patient.appointments}</span>
                  </td>
                  <td data-label="Registered">
                    <span className="users-cell">{patient.createdLabel}</span>
                  </td>
                  <td data-label="Actions">
                    <span className="users-cell">
                      <div className="user-actions">
                        <button type="button" className="user-icon-btn" aria-label={`View ${patient.fullName}`} onClick={() => openView(patient.id)}>
                          <AdminIcon name="view" />
                        </button>
                        {patient.canManage ? (
                          <>
                            <button type="button" className="user-icon-btn" aria-label={`Edit ${patient.fullName}`} onClick={() => setMode({ kind: "edit", patient })}>
                              <AdminIcon name="edit" />
                            </button>
                            <button type="button" className="user-icon-btn user-icon-btn-danger" aria-label={`Delete ${patient.fullName}`} onClick={() => setMode({ kind: "delete", patient })}>
                              <AdminIcon name="trash" />
                            </button>
                          </>
                        ) : (
                          <span className="users-sub">You</span>
                        )}
                      </div>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mode?.kind === "create" ? <CreateDialog onClose={closeMode} /> : null}
      {mode?.kind === "view" ? (
        <ViewDialog patientId={mode.patientId} onClose={closeMode} onEdit={(patient) => setMode({ kind: "edit", patient })} rows={rows} />
      ) : null}
      {mode?.kind === "edit" ? <EditDialog patient={mode.patient} onClose={closeMode} /> : null}
      {mode?.kind === "delete" ? <DeleteDialog patient={mode.patient} onClose={closeMode} /> : null}
    </section>
  );
}

function ViewDialog({
  patientId,
  onClose,
  onEdit,
  rows,
}: {
  patientId: string;
  onClose: () => void;
  onEdit: (patient: PatientRow) => void;
  rows: PatientRow[];
}) {
  const [view, setView] = useState<PatientAccountView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    readPatientAccount(patientId)
      .then((result) => {
        if (!active) return;
        if (!result.ok) setError(result.message);
        else setView(result.patient);
      })
      .catch(() => {
        if (active) setError("Patient details are unavailable right now.");
      });
    return () => {
      active = false;
    };
  }, [patientId]);
  const row = rows.find((item) => item.id === patientId);
  return (
    <Modal title="View patient" onClose={onClose}>
      <div className="user-view">
        {!view && !error ? <p className="user-form-note">Loading profile…</p> : null}
        {error ? (
          <p className="user-form-error" role="alert">
            {error}
          </p>
        ) : null}
        {view ? (
          <>
            <div className="users-person">
              <ProfilePhoto userId={view.userId} name={view.fullName} version={view.imageVersion} size={64} alt="" />
              <span>
                <p className="user-view-email">{view.fullName}</p>
                <p className="user-view-role">{view.email}</p>
              </span>
            </div>
            <dl className="user-view-grid">
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge tone={view.statusTone}>{view.statusLabel}</StatusBadge>
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{view.phone ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Gender</dt>
                <dd>{genderLabel(view.gender)}</dd>
              </div>
              <div>
                <dt>Date of birth</dt>
                <dd>{view.dateOfBirth}</dd>
              </div>
              <div>
                <dt>Nationality</dt>
                <dd>{view.nationality}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>{view.preferredLanguage}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{view.residentialAddress}</dd>
              </div>
              <div>
                <dt>Emergency contact</dt>
                <dd>{view.emergencyContactName}</dd>
              </div>
              <div>
                <dt>Dependent</dt>
                <dd>{view.isDependent ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt>Appointments</dt>
                <dd>
                  <Link className="user-view-link" href={`/admin/appointments?patient=${view.id}`}>
                    {view.appointments}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Registered</dt>
                <dd>{view.createdLabel}</dd>
              </div>
            </dl>
            <div className="user-form-actions">
              <button type="button" className="users-cancel" onClick={onClose}>
                Close
              </button>
              {row?.canManage ? (
                <button type="button" className="users-add" onClick={() => row && onEdit(row)}>
                  <AdminIcon name="edit" />
                  Edit
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(createPatientAction, initial);
  useEffect(() => {
    if (state.tone === "ok") onClose();
  }, [state, onClose]);
  return (
    <Modal title="Add patient" onClose={onClose}>
      <form action={action} className="user-form">
        <label>
          Full name
          <input name="fullName" required autoComplete="name" maxLength={120} />
        </label>
        <label>
          Gender
          <select name="gender" defaultValue="" required>
            <option value="" disabled>
              Select gender
            </option>
            {genders.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date of birth
          <input name="dateOfBirth" type="date" required />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="off" maxLength={254} />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" autoComplete="off" placeholder="+232 76 000 001" />
        </label>
        <label>
          Password
          <input name="password" type="password" required autoComplete="new-password" minLength={6} maxLength={128} />
        </label>
        <p className="user-form-note">Use 6 to 128 characters, with at least one letter and one number. The patient can sign in immediately.</p>
        <FormMessage state={state} />
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="users-add" disabled={pending}>
            {pending ? "Saving…" : "Create patient"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditDialog({ patient, onClose }: { patient: PatientRow; onClose: () => void }) {
  const [state, action, pending] = useActionState(updatePatientAction, initial);
  useEffect(() => {
    if (state.tone === "ok") onClose();
  }, [state, onClose]);
  return (
    <Modal title="Edit patient" onClose={onClose}>
      <form action={action} className="user-form">
        <input type="hidden" name="userId" value={patient.userId} />
        <input type="hidden" name="patientId" value={patient.id} />
        <input type="hidden" name="timezone" value={patient.timezone} />
        <label>
          Full name
          <input name="fullName" defaultValue={patient.fullName} required autoComplete="name" maxLength={120} />
        </label>
        <label>
          Gender
          <select name="gender" defaultValue={genders.some((item) => item.value === patient.gender) ? patient.gender : ""} required>
            <option value="" disabled>
              Select gender
            </option>
            {genders.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date of birth
          <input name="dateOfBirth" type="date" required defaultValue={patient.dateOfBirth} />
        </label>
        <label>
          Email
          <input name="email" type="email" required defaultValue={patient.email} autoComplete="off" maxLength={254} />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" defaultValue={patient.phone ?? ""} autoComplete="off" placeholder="+232 76 000 001" />
        </label>
        <label>
          Nationality
          <input name="nationality" defaultValue={patient.nationality ?? ""} maxLength={80} />
        </label>
        <label>
          Preferred language
          <input name="preferredLanguage" defaultValue={patient.preferredLanguage ?? ""} maxLength={80} />
        </label>
        <label>
          Address
          <input name="residentialAddress" defaultValue={patient.residentialAddress ?? ""} maxLength={200} />
        </label>
        <label>
          Emergency contact name
          <input name="emergencyContactName" defaultValue={patient.emergencyContactName ?? ""} maxLength={120} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={patient.status}>
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label className="service-check">
          <input type="checkbox" name="isDependent" defaultChecked={patient.isDependent} />
          Dependent profile
        </label>
        <label>
          New password
          <input name="password" type="password" autoComplete="new-password" minLength={6} maxLength={128} placeholder="Leave blank to keep the current password" />
        </label>
        <FormMessage state={state} />
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="users-add" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({ patient, onClose }: { patient: PatientRow; onClose: () => void }) {
  const [state, action, pending] = useActionState(deletePatientAction, initial);
  useEffect(() => {
    if (state.tone === "ok") onClose();
  }, [state, onClose]);
  return (
    <Modal title="Delete patient" onClose={onClose}>
      <form action={action} className="user-form">
        <input type="hidden" name="patientId" value={patient.id} />
        <p className="user-form-note">
          Delete {patient.fullName}? The login is closed and this profile is archived. Appointments and payments already stored stay available.
        </p>
        <FormMessage state={state} />
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="users-delete" disabled={pending}>
            {pending ? "Deleting…" : "Delete patient"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="user-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="patient-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="user-modal-head">
          <h2 id="patient-dialog-title">{title}</h2>
          <button type="button" className="user-icon-btn" aria-label="Close" onClick={onClose}>
            <AdminIcon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function FormMessage({ state }: { state: AdminActionState }) {
  if (!state.message) return null;
  return (
    <p className={state.tone === "error" ? "user-form-error" : "user-form-ok"} role={state.tone === "error" ? "alert" : "status"}>
      {state.message}
    </p>
  );
}
