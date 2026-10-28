import { describe, expect, it } from "vitest";
import { scoreAssessment } from "./scoring";
import {
  AUTOMATIC_BAND_LABEL,
  AUTOMATIC_SUM_ALGORITHM,
  bandsCoverSums,
  editorStateFromStored,
  importQuestionFile,
  nextQuestionVersion,
  prepareQuestionSet,
} from "./questions";

const questions = [
  {
    prompt: "How often did this happen?",
    choices: [
      { value: "0", label: "Not at all" },
      { value: "1", label: "Often" },
    ],
    safety: false,
    safetyAtLeast: "",
  },
  {
    prompt: "How often did the other thing happen?",
    choices: [
      { value: "0", label: "Not at all" },
      { value: "2", label: "Often" },
    ],
    safety: true,
    safetyAtLeast: "2",
  },
];

describe("question sets", () => {
  it("numbers the next version after the highest stored release", () => {
    expect(nextQuestionVersion(["1.0"])).toBe("1.1");
    expect(nextQuestionVersion(["1.0", "1.3", "2.0"])).toBe("2.1");
  });

  it("totals the answer values when no bands are supplied", () => {
    const prepared = prepareQuestionSet({ questions, bands: [] });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.prepared.mode).toBe("automatic");
    expect(prepared.prepared.algorithmVersion).toBe(AUTOMATIC_SUM_ALGORITHM);
    expect(prepared.prepared.spec.bands).toEqual([{ min: 0, max: 3, label: AUTOMATIC_BAND_LABEL }]);
    expect(scoreAssessment(prepared.prepared.spec, [1, 2])).toEqual({
      score: 3,
      maxScore: 3,
      band: AUTOMATIC_BAND_LABEL,
      safetyFlag: true,
    });
    expect(scoreAssessment(prepared.prepared.spec, [0, 0])?.safetyFlag).toBe(false);
  });

  it("accepts uploaded bands only when they cover every total", () => {
    const covered = prepareQuestionSet({
      questions,
      bands: [
        { min: "0", max: "1", label: "Lower" },
        { min: "2", max: "3", label: "Higher" },
      ],
    });
    expect(covered.ok).toBe(true);
    if (!covered.ok) return;
    expect(bandsCoverSums(covered.prepared.spec)).toBe(true);
    expect(scoreAssessment(covered.prepared.spec, [0, 2])?.band).toBe("Higher");

    const gapped = prepareQuestionSet({
      questions,
      bands: [
        { min: "0", max: "0", label: "Lower" },
        { min: "2", max: "3", label: "Higher" },
      ],
    });
    expect(gapped.ok).toBe(false);
  });

  it("rejects a scoring label that recommends treatment", () => {
    const prepared = prepareQuestionSet({
      questions,
      bands: [{ min: "0", max: "3", label: "Start pharmacotherapy" }],
    });
    expect(prepared.ok).toBe(false);
  });

  it("reads an uploaded question file without requiring bands", () => {
    const imported = importQuestionFile({
      items: [
        { prompt: "First uploaded question", choices: [{ value: 0, label: "No" }, { value: 1, label: "Yes" }] },
        { prompt: "Second uploaded question", choices: [{ value: 0, label: "No" }, { value: 1, label: "Yes" }] },
      ],
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.state.mode).toBe("automatic");
    expect(imported.state.questions).toHaveLength(2);
    const stored = editorStateFromStored(
      imported.state.questions.map((question, index) => ({
        index,
        prompt: question.prompt,
        choices: question.choices.map((choice) => ({ value: Number(choice.value), label: choice.label })),
      })),
      { kind: "SUM", items: [{ index: 0, min: 0, max: 1 }, { index: 1, min: 0, max: 1 }], bands: [{ min: 0, max: 2, label: AUTOMATIC_BAND_LABEL }], safety: null },
      AUTOMATIC_SUM_ALGORITHM,
    );
    expect(stored.bands).toEqual([]);
    expect(stored.mode).toBe("automatic");
  });
});
