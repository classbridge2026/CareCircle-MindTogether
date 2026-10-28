import type { ScreeningItem, ScoringSpec } from "./scoring";

const choices = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
];

function item(index: number, symptom: string): ScreeningItem {
  return {
    index,
    prompt: `Over the last 2 weeks, how often have you been bothered by ${symptom}`,
    choices,
  };
}

/** Anxiety questions from the supplied GAD-7 form. There is no self-harm item. */
export const GAD7_ITEMS: ScreeningItem[] = [
  item(0, "feeling nervous, anxious, or on edge?"),
  item(1, "not being able to stop or control worrying?"),
  item(2, "worrying too much about different things?"),
  item(3, "trouble relaxing?"),
  item(4, "being so restless that it is hard to sit still?"),
  item(5, "becoming easily annoyed or irritable?"),
  item(6, "feeling afraid as if something awful might happen?"),
];

/**
 * Published 0–21 severity score.
 * The instruction manual sets cut points at 5 (mild), 10 (moderate), and 15 (severe).
 * The band below 5 is Minimal. This form has no item that raises a safety flag.
 */
export const GAD7_SCORING: ScoringSpec = {
  kind: "SUM",
  items: GAD7_ITEMS.map((entry) => ({ index: entry.index, min: 0, max: 3 })),
  bands: [
    { min: 0, max: 4, label: "Minimal" },
    { min: 5, max: 9, label: "Mild" },
    { min: 10, max: 14, label: "Moderate" },
    { min: 15, max: 21, label: "Severe" },
  ],
  safety: null,
};

export const GAD7_ALGORITHM_VERSION = "gad-7-sum-severity-1";

export const GAD7_SOURCE =
  "GAD-7, developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display or distribute.";
