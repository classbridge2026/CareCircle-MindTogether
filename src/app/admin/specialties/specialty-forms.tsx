"use client";

import Link from "next/link";
import { useActionState } from "react";
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass, textAreaClass, textInputClass } from "@/components/form-classes";
import { StatusBadge, verificationBadge } from "@/components/status-badge";
import { createSpecialtyAction, deleteSpecialtyAction, updateSpecialtyAction, type SpecialtyActionState } from "./actions";

const initial: SpecialtyActionState = {};

function claimLabel(status: string) {
  if (status === "VERIFIED") return "Verified";
  if (status === "REJECTED") return "Rejected";
  return "Declared, not verified";
}

export function CreateSpecialtyForm() {
  const [state, action, pending] = useActionState(createSpecialtyAction, initial);
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-navy">Add a specialty</h2>
      {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
      <label className="text-sm font-medium">
        Name
        <input name="name" required className={`${textInputClass} mt-1`} />
      </label>
      <label className="text-sm font-medium">
        Slug
        <input name="slug" required className={`${textInputClass} mt-1`} placeholder="cardiology" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        <span className="mt-1 block text-xs font-normal text-brand-muted">Lowercase letters, numbers, and hyphens. The slug stays fixed after the specialty is created.</span>
      </label>
      <label className="text-sm font-medium">
        Description
        <textarea name="description" className={`${textAreaClass} mt-1`} />
      </label>
      <button className={primaryButtonClass} disabled={pending} type="submit">
        {pending ? "Saving…" : "Create specialty"}
      </button>
    </form>
  );
}

export function SpecialtyEditor({
  specialty,
}: {
  specialty: {
    id: string;
    code: string;
    slug: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
    referenced: boolean;
    doctorCount: number;
    doctors: Array<{
      id: string;
      doctorId: string;
      fullName: string;
      claimStatus: string;
      isPrimary: boolean;
      verificationStatus: string;
    }>;
  };
}) {
  const [state, action, pending] = useActionState(updateSpecialtyAction, initial);
  const [removeState, remove, removePending] = useActionState(deleteSpecialtyAction, initial);
  return (
    <div className="grid gap-4 rounded-2xl border border-brand-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">{specialty.name}</h2>
          <p className="text-xs text-brand-muted">
            {specialty.code} · {specialty.slug}
          </p>
        </div>
        <span className="text-xs font-semibold tracking-wide text-brand-muted uppercase">{specialty.isActive ? "Active" : "Inactive"}</span>
      </div>
      <form action={action} className="grid gap-3">
        <input type="hidden" name="id" value={specialty.id} />
        <label className="text-sm font-medium">
          Name
          <input name="name" defaultValue={specialty.name} required className={`${textInputClass} mt-1`} />
        </label>
        <label className="text-sm font-medium">
          Description
          <textarea name="description" defaultValue={specialty.description ?? ""} className={`${textAreaClass} mt-1`} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Display order
            <input name="sortOrder" type="number" min={0} max={999} defaultValue={specialty.sortOrder} className={`${textInputClass} mt-1`} />
          </label>
          <label className="flex items-end gap-2 pb-3 text-sm font-medium">
            <input name="isActive" type="checkbox" defaultChecked={specialty.isActive} />
            Active for new doctor claims
          </label>
        </div>
        <button className={secondaryButtonClass} disabled={pending} type="submit">
          {pending ? "Saving…" : "Save specialty"}
        </button>
        {state.message ? <p role={state.tone === "error" ? "alert" : "status"}>{state.message}</p> : null}
      </form>
      <div>
        <h3 className="text-sm font-semibold text-brand-navy">Doctors ({specialty.doctorCount})</h3>
        {specialty.doctors.length === 0 ? (
          <p className="mt-2 text-sm text-brand-muted">No doctors are associated with this specialty.</p>
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
          <p className="mt-2 text-xs text-brand-muted">Showing the first {specialty.doctors.length} doctors.</p>
        ) : null}
      </div>
      <form action={remove}>
        <input type="hidden" name="id" value={specialty.id} />
        <button className={dangerButtonClass} disabled={removePending || specialty.referenced} type="submit">
          {removePending ? "Checking…" : "Delete specialty"}
        </button>
        {specialty.referenced ? (
          <p className="mt-2 text-xs leading-5 text-brand-muted">
            This specialty is already referenced. Deactivate it to stop new use without changing existing records.
          </p>
        ) : null}
        {removeState.message ? (
          <p className="mt-2 text-sm" role={removeState.tone === "error" ? "alert" : "status"}>
            {removeState.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
