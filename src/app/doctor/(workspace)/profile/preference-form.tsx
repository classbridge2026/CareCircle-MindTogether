"use client";

import { useActionState } from "react";
import { primaryButtonClass } from "@/components/form-classes";
import { saveOfferingPreferenceAction, type PreferenceActionState } from "./actions";

const initial: PreferenceActionState = {};

type Preference = "ONLINE" | "IN_PERSON" | "BOTH";

const choices: Array<{ value: Preference; label: string }> = [
  { value: "ONLINE", label: "Online" },
  { value: "IN_PERSON", label: "In person" },
  { value: "BOTH", label: "Both" },
];

export function OfferingPreferenceForm({
  specialtyId,
  consultationServiceId,
  serviceName,
  specialtyName,
  serviceMode,
  durationMinutes,
  preference,
  active,
  editable,
}: {
  specialtyId: string;
  consultationServiceId: string;
  serviceName: string;
  specialtyName: string;
  serviceMode: "ONLINE" | "IN_PERSON" | null;
  durationMinutes: number;
  preference: Preference | null;
  active: boolean;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState(saveOfferingPreferenceAction, initial);

  return (
    <form action={action} className="rounded-xl bg-[#F3F8FC] px-3 py-3">
      <input type="hidden" name="specialtyId" value={specialtyId} />
      <input type="hidden" name="consultationServiceId" value={consultationServiceId} />
      <p className="font-semibold text-[#0C2B45]">{serviceName}</p>
      <p className="mt-1 text-sm text-[#5b6b7c]">
        {specialtyName} · {durationMinutes} min · {active ? "Active" : "Inactive"}
        {serviceMode === "ONLINE" ? " · This service is online only" : null}
        {serviceMode === "IN_PERSON" ? " · This service is in person only" : null}
      </p>
      <fieldset className="mt-3" disabled={!editable || pending}>
        <legend className="text-sm font-medium text-[#0C2B45]">Consultation preference</legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          {choices.map((choice) => {
            const allowed = !serviceMode || choice.value === serviceMode;
            return (
              <label key={choice.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="preference"
                  value={choice.value}
                  defaultChecked={preference === choice.value}
                  disabled={!allowed}
                  required
                />
                {choice.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      {editable ? (
        <button className={`${primaryButtonClass} mt-3`} disabled={pending} type="submit">
          {pending ? "Saving…" : "Save preference"}
        </button>
      ) : (
        <p className="mt-3 text-sm text-[#5b6b7c]">An approved profile can set this preference.</p>
      )}
      {state.message ? (
        <p className="mt-2 text-sm" role={state.tone === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
