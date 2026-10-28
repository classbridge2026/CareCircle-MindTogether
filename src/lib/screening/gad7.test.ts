import { describe, expect, it } from "vitest";
import { GAD7_ITEMS, GAD7_SCORING } from "./gad7";
import { parseItems, parseScoringSpec, scoreAssessment } from "./scoring";

describe("GAD-7 installation", () => {
  it("accepts the seven anxiety questions and the 0–21 severity score", () => {
    expect(parseItems(GAD7_ITEMS)).toHaveLength(7);
    expect(parseScoringSpec(GAD7_SCORING)?.bands).toHaveLength(4);
    expect(scoreAssessment(GAD7_SCORING, [0, 0, 0, 0, 0, 0, 0])).toEqual({
      score: 0,
      maxScore: 21,
      band: "Minimal",
      safetyFlag: false,
    });
    expect(scoreAssessment(GAD7_SCORING, [1, 1, 1, 1, 1, 0, 0])).toMatchObject({ score: 5, band: "Mild" });
    expect(scoreAssessment(GAD7_SCORING, [2, 2, 2, 2, 2, 0, 0])).toMatchObject({ score: 10, band: "Moderate" });
    expect(scoreAssessment(GAD7_SCORING, [3, 3, 3, 3, 3, 0, 0])).toMatchObject({
      score: 15,
      band: "Severe",
      safetyFlag: false,
    });
    expect(scoreAssessment(GAD7_SCORING, [3, 3, 3, 3, 3, 3, 3])).toEqual({
      score: 21,
      maxScore: 21,
      band: "Severe",
      safetyFlag: false,
    });
  });
});
