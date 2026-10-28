"use client";

import { useState } from "react";
import type { ScreeningItem } from "@/lib/screening/scoring";
import { submitScreeningAction } from "../../actions";

export function ScreeningSessionForm({
  assessmentId,
  code,
  title,
  items,
  notice,
}: {
  assessmentId: string;
  code: string;
  title: string;
  items: ScreeningItem[];
  notice: string | null;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>(items.map(() => null));
  const [error, setError] = useState<string | null>(null);
  const item = items[index];
  const last = index === items.length - 1;

  function choose(value: number) {
    setAnswers((current) => current.map((entry, position) => (position === index ? value : entry)));
    setError(null);
  }

  function next() {
    if (answers[index] === null) {
      setError("Choose an answer before continuing.");
      return;
    }
    setIndex((current) => Math.min(items.length - 1, current + 1));
  }

  return (
    <form action={submitScreeningAction} className="screen-panel">
      <p className="screen-progress">{index + 1} of {items.length}</p>
      <h1>{title}</h1>
      <fieldset className="grid gap-3">
        <legend className="text-base font-semibold text-[#0C2B45]">{item.prompt}</legend>
        <div className="screen-choices">
          {item.choices.map((choice) => (
            <label key={choice.value} className="screen-choice">
              <input
                checked={answers[index] === choice.value}
                name={`visible-${item.index}`}
                type="radio"
                value={choice.value}
                onChange={() => choose(choice.value)}
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error || notice ? <p role="alert">{error ?? notice}</p> : null}
      <input name="assessmentId" type="hidden" value={assessmentId} />
      <input name="code" type="hidden" value={code} />
      <input name="count" type="hidden" value={items.length} />
      {answers.map((answer, position) => (
        <input key={items[position].index} name={`answer-${position}`} type="hidden" value={answer ?? ""} />
      ))}
      <div className="flex flex-wrap gap-3">
        <button className="rounded-xl border border-[#d7e3ee] bg-white px-4 py-3 text-sm font-semibold text-[#0C2B45]" type="button" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0}>
          Previous
        </button>
        {last ? (
          <button className="rounded-xl bg-[#0F766E] px-4 py-3 text-sm font-semibold text-white" type="submit" disabled={answers.some((answer) => answer === null)}>
            Submit assessment
          </button>
        ) : (
          <button className="rounded-xl bg-[#0F766E] px-4 py-3 text-sm font-semibold text-white" type="button" onClick={next}>
            Next
          </button>
        )}
      </div>
    </form>
  );
}
