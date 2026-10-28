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

/** Depression questions from the supplied Patient Health Questionnaire, question 2. */
export const PHQ9_ITEMS: ScreeningItem[] = [
  item(0, "little interest or pleasure in doing things?"),
  item(1, "feeling down, depressed, or hopeless?"),
  item(2, "trouble falling or staying asleep, or sleeping too much?"),
  item(3, "feeling tired or having little energy?"),
  item(4, "poor appetite or overeating?"),
  item(5, "feeling bad about yourself, or that you are a failure or have let yourself or your family down?"),
  item(6, "trouble concentrating on things, such as reading the newspaper or watching television?"),
  item(7, "moving or speaking so slowly that other people could have noticed, or the opposite — being so fidgety or restless that you have been moving around a lot more than usual?"),
  item(8, "thoughts that you would be better off dead or of hurting yourself in some way?"),
];

/** Published 0–27 severity score. Any answer above “Not at all” on the last question raises the safety flag. */
export const PHQ9_SCORING: ScoringSpec = {
  kind: "SUM",
  items: PHQ9_ITEMS.map((entry) => ({ index: entry.index, min: 0, max: 3 })),
  bands: [
    { min: 0, max: 4, label: "None-minimal" },
    { min: 5, max: 9, label: "Mild" },
    { min: 10, max: 14, label: "Moderate" },
    { min: 15, max: 19, label: "Moderately severe" },
    { min: 20, max: 27, label: "Severe" },
  ],
  safety: { itemIndex: 8, whenAtLeast: 1 },
};

export const PHQ9_ALGORITHM_VERSION = "phq-9-sum-severity-1";

export const PHQ9_SOURCE =
  "Patient Health Questionnaire depression items, developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display or distribute.";
