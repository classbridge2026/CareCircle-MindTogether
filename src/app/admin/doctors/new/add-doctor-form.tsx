"use client";

import { useActionState } from "react";
import { primaryButtonClass, textAreaClass, textInputClass } from "@/components/form-classes";
import { addDoctorAction, type AddDoctorState } from "./actions";

const initial: AddDoctorState = { ok: false };

export function AddDoctorForm({
  specialties,
  emailHint,
}: {
  specialties: Array<{ id: string; name: string }>;
  emailHint: string | null;
}) {
  const [state, action, pending] = useActionState(addDoctorAction, initial);
  const errors = state.ok ? {} : (state.fieldErrors ?? {});
  return (
    <form action={action} className="mt-6 grid max-w-3xl gap-4" noValidate>
      {state.ok || state.formMessage ? (
        <p
          role={state.ok && state.emailSent ? "status" : "alert"}
          className={`rounded-xl border px-3 py-3 text-sm leading-6 ${
            state.ok && state.emailSent ? "border-brand-teal/30 bg-[#e5f4f2]" : "border-brand-danger/30 bg-[#fdf4f4]"
          }`}
        >
          {state.ok ? state.message : state.formMessage}
        </p>
      ) : null}
      {emailHint ? (
        <p className="rounded-xl border border-brand-line bg-white px-3 py-3 text-sm leading-6 text-brand-ink">{emailHint}</p>
      ) : null}
      <Field label="Full name" name="fullName" error={errors.fullName} autoComplete="name" />
      <Field label="Email address" name="email" type="email" error={errors.email} autoComplete="email" />
      <Field label="Phone number" name="phone" error={errors.phone} autoComplete="tel" hint="Use an international number, or a Sierra Leone number starting with 0." />
      <label className="text-sm font-medium text-brand-ink">
        Specialty
        <select name="specialtyId" className={`${textInputClass} mt-1`} defaultValue="">
          <option value="">Choose a specialty</option>
          {specialties.map((specialty) => (
            <option key={specialty.id} value={specialty.id}>
              {specialty.name}
            </option>
          ))}
        </select>
        {errors.specialtyId ? <span className="mt-1 block text-sm text-brand-danger">{errors.specialtyId}</span> : null}
      </label>
      <Field label="Qualification, if already known" name="qualificationTitle" error={errors.qualificationTitle} required={false} />
      <Field label="Years of experience, if already known" name="yearsExperience" error={errors.yearsExperience} required={false} />
      <label className="text-sm font-medium text-brand-ink">
        Initial professional details
        <textarea name="biography" className={`${textAreaClass} mt-1`} maxLength={4000} />
      </label>
      <button className={primaryButtonClass} type="submit" disabled={pending || specialties.length === 0}>
        {pending ? "Creating doctor…" : "Create doctor and send invitation"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  type = "text",
  autoComplete,
  required = true,
  hint,
}: {
  label: string;
  name: string;
  error?: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="text-sm font-medium text-brand-ink">
      {label}
      <input name={name} type={type} autoComplete={autoComplete} required={required} className={`${textInputClass} mt-1`} />
      {hint ? <span className="mt-1 block font-normal text-brand-muted">{hint}</span> : null}
      {error ? <span className="mt-1 block text-sm text-brand-danger">{error}</span> : null}
    </label>
  );
}
