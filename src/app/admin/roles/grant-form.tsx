"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "@/components/admin/admin-icons";
import type { AdminActionState } from "@/lib/admin/action-state";
import { grantRoleByEmailAction } from "@/app/admin/access/actions";

const initial: AdminActionState = {};

export function GrantRoleForm() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="users-add" onClick={() => setOpen(true)}>
        <AdminIcon name="plus" />
        Grant administrator access
      </button>
      {open ? <GrantDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function GrantDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(grantRoleByEmailAction, initial);
  const closed = useRef(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (closed.current || state.tone !== "ok") return;
    closed.current = true;
    onClose();
    router.refresh();
  }, [onClose, router, state.tone]);

  return (
    <div className="user-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="user-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grant-admin-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="user-modal-head">
          <h2 id="grant-admin-title">Grant administrator access</h2>
          <button type="button" className="user-icon-btn" aria-label="Close" onClick={onClose}>
            <AdminIcon name="close" />
          </button>
        </header>
        <form action={action} className="user-form">
          <p className="user-form-note">The account must already be active. This does not create a user or assign a doctor role.</p>
          <label>
            Account email
            <input name="email" type="email" required maxLength={254} autoComplete="off" />
          </label>
          <label>
            Role
            <select name="roleCode" defaultValue="ADMIN">
              <option value="ADMIN">Administrator</option>
              <option value="SUPER_ADMIN">Super administrator</option>
            </select>
          </label>
          {state.tone === "error" && state.message ? (
            <p className="user-form-error" role="alert">
              {state.message}
            </p>
          ) : null}
          <div className="user-form-actions">
            <button type="button" className="users-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="users-add" disabled={pending}>
              {pending ? "Saving…" : "Grant role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
