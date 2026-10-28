"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AdminIcon } from "@/components/admin/admin-icons";
import { ProfilePhoto } from "@/components/profile-photo";
import { StatusBadge } from "@/components/status-badge";
import type { BadgeTone } from "@/lib/admin/labels";
import { addDoctorAction, type AddDoctorState } from "../new/actions";
import { DoctorDecisions } from "../[id]/decision-forms";
import { deleteDoctorAction, readDoctorReview, updateDoctorAction, type DoctorReviewView } from "../actions";
import type { AdminActionState } from "../actions";

export type DoctorRow = {
  id: string;
  userId: string;
  imageVersion: string | null;
  fullName: string;
  displayName: string;
  email: string;
  phone: string;
  specialtyLabel: string;
  verificationLabel: string;
  verificationTone: BadgeTone;
  accountLabel: string;
  accountTone: BadgeTone;
  createdLabel: string;
  qualificationTitle: string;
  yearsExperience: string;
  biography: string;
  canManage: boolean;
};

const initialAction: AdminActionState = {};
const initialCreate: AddDoctorState = { ok: false };

type Mode = { kind: "create" } | { kind: "view"; doctorId: string } | { kind: "edit"; doctor: DoctorRow } | { kind: "delete"; doctor: DoctorRow } | null;

function rememberView(doctorId: string | null) {
  const url = new URL(window.location.href);
  if (doctorId) url.searchParams.set("view", doctorId);
  else url.searchParams.delete("view");
  const next = `${url.pathname}${url.search}`;
  if (`${window.location.pathname}${window.location.search}` !== next) window.history.replaceState(null, "", next);
}

export function DoctorsBoard({
  rows,
  specialties,
  emailHint,
  initialViewId = null,
}: {
  rows: DoctorRow[];
  specialties: Array<{ id: string; name: string }>;
  emailHint: string | null;
  initialViewId?: string | null;
}) {
  const [mode, setMode] = useState<Mode>(initialViewId ? { kind: "view", doctorId: initialViewId } : null);

  function openView(doctorId: string) {
    setMode({ kind: "view", doctorId });
    rememberView(doctorId);
  }

  function closeMode() {
    setMode(null);
    rememberView(null);
  }

  return (
    <section className="users-card">
      <header className="users-card-head">
        <h2>Doctors</h2>
        <button type="button" className="users-add" onClick={() => setMode({ kind: "create" })}>
          <AdminIcon name="plus" />
          Add doctor
        </button>
      </header>
      {rows.length === 0 ? (
        <p className="users-empty">No doctors match these filters.</p>
      ) : (
        <div className="users-table-wrap">
          <table className="users-table doctors-table">
            <caption className="sr-only">Doctors</caption>
            <colgroup>
              <col className="doctors-col-name" />
              <col className="doctors-col-specialty" />
              <col className="doctors-col-verify" />
              <col className="doctors-col-account" />
              <col className="doctors-col-added" />
              <col className="doctors-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Specialty</th>
                <th>Verification</th>
                <th>Account</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((doctor) => (
                <tr key={doctor.id}>
                  <td data-label="Doctor">
                    <span className="users-cell">
                      <span className="users-person">
                        <ProfilePhoto userId={doctor.userId} name={doctor.fullName} version={doctor.imageVersion} size={36} />
                        <span>
                          <button type="button" className="users-email" onClick={() => openView(doctor.id)}>
                            {doctor.fullName}
                          </button>
                          <span className="users-sub">{doctor.displayName}</span>
                          <span className="users-sub">{doctor.email}</span>
                        </span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Specialty">
                    <span className="users-cell">{doctor.specialtyLabel}</span>
                  </td>
                  <td data-label="Verification">
                    <span className="users-cell">
                      <StatusBadge tone={doctor.verificationTone}>{doctor.verificationLabel}</StatusBadge>
                    </span>
                  </td>
                  <td data-label="Account">
                    <span className="users-cell">
                      <StatusBadge tone={doctor.accountTone}>{doctor.accountLabel}</StatusBadge>
                    </span>
                  </td>
                  <td data-label="Added">
                    <span className="users-cell">{doctor.createdLabel}</span>
                  </td>
                  <td data-label="Actions">
                    <span className="users-cell">
                      <div className="user-actions">
                        <button type="button" className="user-icon-btn" aria-label={`Review ${doctor.fullName}`} onClick={() => openView(doctor.id)}>
                          <AdminIcon name="view" />
                        </button>
                        {doctor.canManage ? (
                          <>
                            <button type="button" className="user-icon-btn" aria-label={`Edit ${doctor.fullName}`} onClick={() => setMode({ kind: "edit", doctor })}>
                              <AdminIcon name="edit" />
                            </button>
                            <button type="button" className="user-icon-btn user-icon-btn-danger" aria-label={`Delete ${doctor.fullName}`} onClick={() => setMode({ kind: "delete", doctor })}>
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
      {mode?.kind === "create" ? <CreateDialog specialties={specialties} emailHint={emailHint} onClose={closeMode} /> : null}
      {mode?.kind === "view" ? <ReviewDialog doctorId={mode.doctorId} onClose={closeMode} onEdit={(doctor) => setMode({ kind: "edit", doctor })} /> : null}
      {mode?.kind === "edit" ? <EditDialog doctor={mode.doctor} onClose={closeMode} /> : null}
      {mode?.kind === "delete" ? <DeleteDialog doctor={mode.doctor} onClose={closeMode} /> : null}
    </section>
  );
}

function ReviewDialog({ doctorId, onClose, onEdit }: { doctorId: string; onClose: () => void; onEdit: (doctor: DoctorRow) => void }) {
  const [doctor, setDoctor] = useState<DoctorReviewView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    readDoctorReview(doctorId)
      .then((result) => {
        if (!active) return;
        if (!result.ok) setError(result.message);
        else setDoctor(result.doctor);
      })
      .catch(() => {
        if (active) setError("Doctor details are unavailable right now.");
      });
    return () => {
      active = false;
    };
  }, [doctorId]);
  return (
    <Modal title="Review profile" wide onClose={onClose}>
      <div className="user-view">
        {!doctor && !error ? <p className="user-form-note">Loading profile…</p> : null}
        {error ? (
          <p className="user-form-error" role="alert">
            {error}
          </p>
        ) : null}
        {doctor ? (
          <>
            <div className="users-person">
              <ProfilePhoto userId={doctor.userId} name={doctor.fullName} version={doctor.imageVersion} size={64} alt={`${doctor.fullName} profile photo`} />
              <span>
                <p className="user-view-email">{doctor.fullName}</p>
                <p className="user-view-role">{doctor.displayName}</p>
              </span>
            </div>
            <div className="user-actions">
              <StatusBadge tone={doctor.verificationTone}>{doctor.verificationLabel}</StatusBadge>
              <StatusBadge tone={doctor.accountTone}>{doctor.accountLabel}</StatusBadge>
            </div>
            <p className="user-form-note">{doctor.reviewNote}</p>
            <Link className="user-view-link" href={`/admin/doctors/${doctor.id}/availability`}>
              Manage availability
            </Link>
            <dl className="user-view-grid">
              <Field label="Professional email" value={doctor.email} />
              <Field label="Phone" value={doctor.phone ?? "Not recorded"} />
              <Field label="Qualification type" value={doctor.qualification} />
              <Field label="Qualification" value={doctor.qualificationTitle || "Not recorded"} />
              <Field label="Institution" value={doctor.institution} />
              <Field label="Qualification year" value={doctor.qualificationYear} />
              <Field label="Registration or licence number" value={doctor.licenseNumber} />
              <Field label="Licensing authority" value={doctor.licenseAuthority} />
              <Field label="Licence expiry" value={doctor.licenseExpiry} />
              <Field label="Years of experience" value={doctor.experience} />
              <Field label="Languages" value={doctor.languages} />
              <Field label="Consultation preferences" value={doctor.consultation} />
            </dl>
            <section className="user-view-section">
              <h3>Biography</h3>
              <p className="user-form-note">{doctor.biography || "Not recorded"}</p>
            </section>
            {doctor.rejectionReason ? <Note label="Rejection reason" value={doctor.rejectionReason} /> : null}
            {doctor.correctionNotes ? <Note label="Corrections requested" value={doctor.correctionNotes} /> : null}
            {doctor.suspensionReason ? <Note label="Suspension reason" value={doctor.suspensionReason} /> : null}
            <section className="user-view-section">
              <h3>Specialties</h3>
              {doctor.specialties.length === 0 ? <p className="user-form-note">No specialty has been declared.</p> : null}
              <ul>
                {doctor.specialties.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.name}
                      {item.primary ? " · Primary" : ""}
                      {item.inactive ? " · Specialty inactive" : ""}
                    </span>
                    <StatusBadge tone={item.claimTone}>{item.claimLabel}</StatusBadge>
                  </li>
                ))}
              </ul>
            </section>
            <section className="user-view-section">
              <h3>Credentials</h3>
              {doctor.credentials.length === 0 ? <p className="user-form-note">No documents uploaded.</p> : null}
              <ul>
                {doctor.credentials.map((credential) => (
                  <li key={credential.id}>
                    <span>
                      {credential.label}
                      <span className="users-sub">{credential.detail}</span>
                    </span>
                    <Link href={`/admin/doctors/${doctor.id}/credentials/${credential.id}`}>Review document</Link>
                  </li>
                ))}
              </ul>
            </section>
            <div className="user-view-forms">
              <DoctorDecisions doctorId={doctor.id} {...doctor.decisions} />
            </div>
            <section className="user-view-section">
              <h3>Open appointments</h3>
              {doctor.appointments.length === 0 ? <p className="user-form-note">No open appointments. Suspension and rejection do not cancel stored records.</p> : null}
              <ul>
                {doctor.appointments.map((appointment) => (
                  <li key={appointment.id}>
                    <span>{appointment.label}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="user-view-section">
              <h3>Verification history</h3>
              {doctor.events.length === 0 ? <p className="user-form-note">No decisions recorded yet.</p> : null}
              <ul>
                {doctor.events.map((event) => (
                  <li key={event.id}>
                    <span>
                      {event.label}
                      {event.reason ? <span className="users-sub">{event.reason}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="user-view-section">
              <h3>Invitations</h3>
              {doctor.invitations.length === 0 ? <p className="user-form-note">No invitations recorded.</p> : null}
              <ul>
                {doctor.invitations.map((invitation) => (
                  <li key={invitation.id}>
                    <span className="user-actions">
                      <StatusBadge tone={invitation.statusTone}>{invitation.statusLabel}</StatusBadge>
                      <StatusBadge tone={invitation.deliveryTone}>{invitation.deliveryLabel}</StatusBadge>
                    </span>
                    <span>{invitation.expiresLabel}</span>
                  </li>
                ))}
              </ul>
              <Link className="user-view-link" href="/admin/doctors/invitations">
                Manage invitations
              </Link>
            </section>
            <div className="user-form-actions">
              <button type="button" className="users-cancel" onClick={onClose}>
                Close
              </button>
              {doctor.canManage ? (
                <button
                  type="button"
                  className="users-add"
                  onClick={() =>
                    onEdit({
                      id: doctor.id,
                      userId: doctor.userId,
                      imageVersion: doctor.imageVersion,
                      fullName: doctor.fullName,
                      displayName: doctor.displayName,
                      email: doctor.email,
                      phone: doctor.phone ?? "",
                      specialtyLabel: doctor.specialties.find((item) => item.primary)?.name ?? doctor.specialties[0]?.name ?? "None declared",
                      verificationLabel: doctor.verificationLabel,
                      verificationTone: doctor.verificationTone,
                      accountLabel: doctor.accountLabel,
                      accountTone: doctor.accountTone,
                      createdLabel: "",
                      qualificationTitle: doctor.qualificationTitle,
                      yearsExperience: doctor.yearsExperience,
                      biography: doctor.biography,
                      canManage: true,
                    })
                  }
                >
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Note({ label, value }: { label: string; value: string }) {
  return (
    <section className="user-view-section">
      <h3>{label}</h3>
      <p className="user-form-note">{value}</p>
    </section>
  );
}

function CreateDialog({ specialties, emailHint, onClose }: { specialties: Array<{ id: string; name: string }>; emailHint: string | null; onClose: () => void }) {
  const [state, action, pending] = useActionState(addDoctorAction, initialCreate);
  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);
  const errors = state.ok ? {} : (state.fieldErrors ?? {});
  return (
    <Modal title="Add doctor" onClose={onClose}>
      <form action={action} className="user-form">
        {emailHint ? <p className="user-form-note">{emailHint}</p> : null}
        <p className="user-form-note">This creates a doctor account and a single-use invitation. The doctor sets their own password from the link.</p>
        <label>
          Full name
          <input name="fullName" required autoComplete="name" maxLength={120} />
          {errors.fullName ? <span className="user-form-error">{errors.fullName}</span> : null}
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="off" maxLength={254} />
          {errors.email ? <span className="user-form-error">{errors.email}</span> : null}
        </label>
        <label>
          Phone
          <input name="phone" type="tel" required autoComplete="off" placeholder="+232 76 000 001" />
          {errors.phone ? <span className="user-form-error">{errors.phone}</span> : null}
        </label>
        <label>
          Specialty
          <select name="specialtyId" required defaultValue="">
            <option value="" disabled>
              Choose a specialty
            </option>
            {specialties.map((specialty) => (
              <option key={specialty.id} value={specialty.id}>
                {specialty.name}
              </option>
            ))}
          </select>
          {errors.specialtyId ? <span className="user-form-error">{errors.specialtyId}</span> : null}
        </label>
        <label>
          Qualification, if already known
          <input name="qualificationTitle" maxLength={160} />
        </label>
        <label>
          Years of experience, if already known
          <input name="yearsExperience" inputMode="numeric" maxLength={2} />
        </label>
        <label>
          Initial professional details
          <textarea name="biography" maxLength={4000} />
        </label>
        {!state.ok && state.formMessage ? (
          <p className="user-form-error" role="alert">
            {state.formMessage}
          </p>
        ) : null}
        {specialties.length === 0 ? <p className="user-form-error">Add an active specialty before inviting a doctor.</p> : null}
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="users-add" disabled={pending || specialties.length === 0}>
            {pending ? "Saving…" : "Create doctor"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditDialog({ doctor, onClose }: { doctor: DoctorRow; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateDoctorAction, initialAction);
  useEffect(() => {
    if (state.tone === "ok") onClose();
  }, [state, onClose]);
  return (
    <Modal title="Edit doctor" onClose={onClose}>
      <form action={action} className="user-form">
        <input type="hidden" name="doctorId" value={doctor.id} />
        <label>
          Full name
          <input name="fullName" required defaultValue={doctor.fullName} autoComplete="name" maxLength={120} />
        </label>
        <label>
          Display name
          <input name="displayName" required defaultValue={doctor.displayName} maxLength={120} />
        </label>
        <label>
          Email
          <input value={doctor.email} readOnly />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" required defaultValue={doctor.phone} autoComplete="off" placeholder="+232 76 000 001" />
        </label>
        <label>
          Qualification
          <input name="qualificationTitle" defaultValue={doctor.qualificationTitle} maxLength={160} />
        </label>
        <label>
          Years of experience
          <input name="yearsExperience" defaultValue={doctor.yearsExperience} inputMode="numeric" maxLength={2} />
        </label>
        <label>
          Biography
          <textarea name="biography" defaultValue={doctor.biography} maxLength={4000} />
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

function DeleteDialog({ doctor, onClose }: { doctor: DoctorRow; onClose: () => void }) {
  const [state, action, pending] = useActionState(deleteDoctorAction, initialAction);
  useEffect(() => {
    if (state.tone === "ok") onClose();
  }, [state, onClose]);
  return (
    <Modal title="Delete doctor" onClose={onClose}>
      <form action={action} className="user-form">
        <input type="hidden" name="doctorId" value={doctor.id} />
        <p className="user-form-note">
          Delete {doctor.fullName}? The account will be closed and open sessions will end. Appointments and verification history already stored stay available.
        </p>
        <FormMessage state={state} />
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="users-delete" disabled={pending}>
            {pending ? "Deleting…" : "Delete doctor"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, wide = false, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="user-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className={wide ? "user-modal user-modal-wide" : "user-modal"} role="dialog" aria-modal="true" aria-labelledby="doctor-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="user-modal-head">
          <h2 id="doctor-dialog-title">{title}</h2>
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
