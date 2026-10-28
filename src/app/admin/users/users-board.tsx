"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AdminIcon } from "@/components/admin/admin-icons";
import { StatusBadge } from "@/components/status-badge";
import type { AdminActionState } from "@/lib/admin/action-state";
import type { BadgeTone } from "@/lib/admin/labels";
import { ProfilePhoto } from "@/components/profile-photo";
import { UserAccountForms } from "./[id]/user-forms";
import { createUserAction, deleteUserAction, readUserAccount, updateUserAction, type UserAccountView } from "./actions";

export type UserRow = {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  roleLabel: string;
  status: string;
  statusLabel: string;
  statusTone: BadgeTone;
  createdLabel: string;
  timezone: string;
  canManage: boolean;
  lockLabel: string;
  imageVersion: string | null;
};

function UserAvatar({
  userId,
  name,
  imageVersion,
  size,
  alt = "",
}: {
  userId: string;
  name: string;
  imageVersion: string | null;
  size: number;
  alt?: string;
}) {
  return <ProfilePhoto userId={userId} name={name} version={imageVersion} size={size} alt={alt} />;
}

const initial: AdminActionState = {};
const statuses = [
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING_VERIFICATION", label: "Pending verification" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DISABLED", label: "Disabled" },
];

type Mode = { kind: "create" } | { kind: "view"; userId: string } | { kind: "edit"; user: UserRow } | { kind: "delete"; user: UserRow } | null;

function rememberView(userId: string | null) {
  const url = new URL(window.location.href);
  if (userId) url.searchParams.set("view", userId);
  else url.searchParams.delete("view");
  const next = `${url.pathname}${url.search}`;
  if (`${window.location.pathname}${window.location.search}` !== next) window.history.replaceState(null, "", next);
}

export function UsersBoard({
  rows,
  canCreateElevated,
  initialViewId = null,
}: {
  rows: UserRow[];
  canCreateElevated: boolean;
  initialViewId?: string | null;
}) {
  const [mode, setMode] = useState<Mode>(initialViewId ? { kind: "view", userId: initialViewId } : null);

  function openView(userId: string) {
    setMode({ kind: "view", userId });
    rememberView(userId);
  }

  function closeMode() {
    setMode(null);
    rememberView(null);
  }
  return (
    <section className="users-card">
      <header className="users-card-head">
        <h2>Accounts</h2>
        <button type="button" className="users-add" onClick={() => setMode({ kind: "create" })}>
          <AdminIcon name="plus" />
          Add user
        </button>
      </header>
      {rows.length === 0 ? (
        <p className="users-empty">No accounts match these filters.</p>
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <caption className="sr-only">Users</caption>
            <colgroup>
              <col className="users-col-account" />
              <col className="users-col-role" />
              <col className="users-col-status" />
              <col className="users-col-created" />
              <col className="users-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Account</th>
                <th>Access</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id}>
                  <td data-label="Account">
                    <span className="users-cell">
                      <span className="users-person">
                        <UserAvatar userId={user.id} name={user.name ?? user.email} imageVersion={user.imageVersion} size={36} />
                        <span>
                          <button type="button" className="users-email" onClick={() => openView(user.id)}>
                            {user.email}
                          </button>
                          <span className="users-sub">{user.name ?? "No profile name"}</span>
                          {user.phone ? <span className="users-sub">{user.phone}</span> : null}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Access">
                    <span className="users-cell">{user.roleLabel}</span>
                  </td>
                  <td data-label="Status">
                    <span className="users-cell">
                      <StatusBadge tone={user.statusTone}>{user.statusLabel}</StatusBadge>
                    </span>
                  </td>
                  <td data-label="Created">
                    <span className="users-cell">{user.createdLabel}</span>
                  </td>
                  <td data-label="Actions">
                    <span className="users-cell">
                    <div className="user-actions">
                      <button type="button" className="user-icon-btn" aria-label={`View ${user.email}`} onClick={() => openView(user.id)}>
                        <AdminIcon name="view" />
                      </button>
                      {user.canManage ? (
                        <>
                          <button type="button" className="user-icon-btn" aria-label={`Edit ${user.email}`} onClick={() => setMode({ kind: "edit", user })}>
                            <AdminIcon name="edit" />
                          </button>
                          <button type="button" className="user-icon-btn user-icon-btn-danger" aria-label={`Delete ${user.email}`} onClick={() => setMode({ kind: "delete", user })}>
                            <AdminIcon name="trash" />
                          </button>
                        </>
                      ) : (
                        <span className="users-sub">{user.lockLabel}</span>
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
      {mode?.kind === "create" ? <CreateDialog canCreateElevated={canCreateElevated} onClose={closeMode} /> : null}
      {mode?.kind === "view" ? (
        <ViewDialog
          userId={mode.userId}
          onClose={closeMode}
          onEdit={(user) => setMode({ kind: "edit", user })}
        />
      ) : null}
      {mode?.kind === "edit" ? <EditDialog user={mode.user} onClose={closeMode} /> : null}
      {mode?.kind === "delete" ? <DeleteDialog user={mode.user} onClose={closeMode} /> : null}
    </section>
  );
}

function ViewDialog({ userId, onClose, onEdit }: { userId: string; onClose: () => void; onEdit: (user: UserRow) => void }) {
  const [view, setView] = useState<UserAccountView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    readUserAccount(userId)
      .then((result) => {
        if (!active) return;
        if (!result.ok) setError(result.message);
        else setView(result.user);
      })
      .catch(() => {
        if (active) setError("Account details are unavailable right now.");
      });
    return () => {
      active = false;
    };
  }, [userId]);
  return (
    <Modal title="View user" onClose={onClose}>
      <div className="user-view">
        {!view && !error ? <p className="user-form-note">Loading account…</p> : null}
        {error ? <p className="user-form-error" role="alert">{error}</p> : null}
        {view ? (
          <>
            <div className="users-person">
              <UserAvatar userId={view.id} name={view.name ?? view.email} imageVersion={view.imageVersion} size={64} alt={`${view.name ?? view.email} profile photo`} />
              <span>
                <p className="user-view-email">{view.email}</p>
                <p className="user-view-role">{view.roleLabel}</p>
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
                <dt>Name</dt>
                <dd>{view.name ?? "No profile name"}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{view.phone ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Timezone</dt>
                <dd>{view.timezone}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{view.createdLabel}</dd>
              </div>
              <div>
                <dt>Last sign-in</dt>
                <dd>{view.lastLoginLabel}</dd>
              </div>
              <div>
                <dt>Email verified</dt>
                <dd>{view.emailVerifiedLabel}</dd>
              </div>
              <div>
                <dt>Open sessions</dt>
                <dd>{view.openSessions}</dd>
              </div>
            </dl>
            {view.roles.length > 0 ? (
              <section className="user-view-section">
                <h3>Roles</h3>
                <ul>
                  {view.roles.map((role) => (
                    <li key={role.code}>
                      <span>{role.name}</span>
                      <span>Granted {role.grantedLabel}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {view.patient ? (
              <Link className="user-view-link" href={`/admin/patients/${view.patient.id}`}>
                Patient profile: {view.patient.fullName}
              </Link>
            ) : null}
            {view.doctor ? (
              <Link className="user-view-link" href={`/admin/doctors/${view.doctor.id}`}>
                Doctor profile: {view.doctor.fullName}{" "}
                <StatusBadge tone={view.doctor.verificationTone}>{view.doctor.verificationLabel}</StatusBadge>
              </Link>
            ) : null}
            {view.notices.map((notice) => (
              <p key={notice} className="user-form-note">
                {notice}
              </p>
            ))}
            {view.forms.canSuspend || view.forms.canReactivate || view.forms.canManagePrivileges ? (
              <div className="user-view-forms">
                <UserAccountForms userId={view.id} {...view.forms} />
              </div>
            ) : null}
            <div className="user-form-actions">
              <button type="button" className="users-cancel" onClick={onClose}>
                Close
              </button>
              {view.canManage ? (
                <button
                  type="button"
                  className="users-add"
                  onClick={() =>
                    onEdit({
                      id: view.id,
                      email: view.email,
                      phone: view.phone,
                      name: view.name,
                      roleLabel: view.roleLabel,
                      status: view.status,
                      statusLabel: view.statusLabel,
                      statusTone: view.statusTone,
                      createdLabel: view.createdLabel,
                      timezone: view.timezone,
                      canManage: true,
                      lockLabel: "",
                      imageVersion: view.imageVersion,
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

function CreateDialog({ canCreateElevated, onClose }: { canCreateElevated: boolean; onClose: () => void }) {
  const [state, action, pending] = useActionState(createUserAction, initial);
  const [role, setRole] = useState("PATIENT");
  useEffect(() => {
    if (state.tone === "ok") onClose();
  }, [state, onClose]);
  return (
    <Modal title="Add user" onClose={onClose}>
      <form action={action} className="user-form">
        <label>
          Role
          <select name="roleCode" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="PATIENT">Patient</option>
            {canCreateElevated ? <option value="ADMIN">Administrator</option> : null}
            {canCreateElevated ? <option value="SUPER_ADMIN">Super administrator</option> : null}
          </select>
        </label>
        <label>
          Full name
          <input name="fullName" required={role === "PATIENT"} autoComplete="name" maxLength={120} />
        </label>
        {role === "PATIENT" ? (
          <>
            <label>
              Gender
              <select name="gender" defaultValue="" required>
                <option value="" disabled>
                  Select gender
                </option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </label>
            <label>
              Date of birth
              <input name="dateOfBirth" type="date" required />
            </label>
          </>
        ) : (
          <input type="hidden" name="gender" value="" />
        )}
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
        <p className="user-form-note">Use 6 to 128 characters, with at least one letter and one number. The account can sign in immediately.</p>
        <FormMessage state={state} />
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="users-add" disabled={pending}>
            {pending ? "Saving…" : "Create account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateUserAction, initial);
  useEffect(() => {
    if (state.tone === "ok") onClose();
  }, [state, onClose]);
  return (
    <Modal title="Edit user" onClose={onClose}>
      <form action={action} className="user-form">
        <input type="hidden" name="userId" value={user.id} />
        <label>
          Full name
          <input name="fullName" defaultValue={user.name ?? ""} required={Boolean(user.name)} autoComplete="name" maxLength={120} />
        </label>
        <label>
          Email
          <input name="email" type="email" required defaultValue={user.email} autoComplete="off" maxLength={254} />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" defaultValue={user.phone ?? ""} autoComplete="off" placeholder="+232 76 000 001" />
        </label>
        <label>
          Timezone
          <input name="timezone" defaultValue={user.timezone} required maxLength={64} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={user.status}>
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
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

function DeleteDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [state, action, pending] = useActionState(deleteUserAction, initial);
  useEffect(() => {
    if (state.tone === "ok") onClose();
  }, [state, onClose]);
  return (
    <Modal title="Delete user" onClose={onClose}>
      <form action={action} className="user-form">
        <input type="hidden" name="userId" value={user.id} />
        <p className="user-form-note">
          Delete {user.email}? The account will be closed and open sessions will end. Appointments and payment history already stored stay available.
        </p>
        <FormMessage state={state} />
        <div className="user-form-actions">
          <button type="button" className="users-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="users-delete" disabled={pending}>
            {pending ? "Deleting…" : "Delete account"}
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
      <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="user-modal-head">
          <h2 id="user-dialog-title">{title}</h2>
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
