import { describe, expect, it } from "vitest";
import { parseItems, parseScoringSpec, scoreAssessment } from "./scoring";
import { PHQ9_ITEMS, PHQ9_SCORING } from "./phq9";

describe("PHQ-9 installation", () => {
  it("accepts the nine depression questions and the 0–27 severity score", () => {
    expect(parseItems(PHQ9_ITEMS)).toHaveLength(9);
    expect(parseScoringSpec(PHQ9_SCORING)?.bands).toHaveLength(5);
    expect(scoreAssessment(PHQ9_SCORING, [0, 0, 0, 0, 0, 0, 0, 0, 0])).toEqual({
      score: 0,
      maxScore: 27,
      band: "None-minimal",
      safetyFlag: false,
    });
    expect(scoreAssessment(PHQ9_SCORING, [1, 1, 1, 1, 1, 0, 0, 0, 0])).toMatchObject({ score: 5, band: "Mild" });
    expect(scoreAssessment(PHQ9_SCORING, [3, 3, 3, 3, 3, 3, 3, 3, 3])).toEqual({
      score: 27,
      maxScore: 27,
      band: "Severe",
      safetyFlag: true,
    });
    expect(scoreAssessment(PHQ9_SCORING, [0, 0, 0, 0, 0, 0, 0, 0, 1])?.safetyFlag).toBe(true);
  });
});
