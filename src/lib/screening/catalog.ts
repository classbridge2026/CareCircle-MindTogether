import type { ScreeningCategoryCode } from "./rules";

export type ScreeningCandidate = {
  code: string;
  category: ScreeningCategoryCode;
  title: string;
  abbreviation: string;
  detail: string;
};

/** Display metadata only. Question text and scoring rules are not stored here. */
export const SCREENING_CANDIDATES: ScreeningCandidate[] = [
  { code: "PHQ9", category: "DEPRESSION", title: "Depression", abbreviation: "PHQ-9", detail: "Screen for depressive symptoms" },
  { code: "MDQ", category: "BIPOLAR", title: "Bipolar disorder", abbreviation: "MDQ", detail: "Screen for history of bipolar symptoms" },
  { code: "ASRM", category: "MANIA", title: "Mania", abbreviation: "ASRM", detail: "Screen for manic symptoms" },
  { code: "GAD7", category: "ANXIETY", title: "Anxiety", abbreviation: "GAD-7", detail: "Screen for anxiety symptoms" },
  { code: "PSYCHOSIS", category: "PSYCHOSIS", title: "Schizophrenia / psychosis", abbreviation: "Pending", detail: "Screen for psychosis-related symptoms" },
  { code: "AD8", category: "COGNITIVE", title: "Dementia", abbreviation: "AD8", detail: "Screen for cognitive impairment" },
  { code: "ASSIST", category: "SUBSTANCE", title: "Substance use disorders", abbreviation: "WHO ASSIST", detail: "Screen for risky substance use" },
  { code: "OCIR", category: "OCD", title: "OCD", abbreviation: "OCI-R", detail: "Screen for obsessive and compulsive symptoms" },
  { code: "PERSONALITY", category: "PERSONALITY", title: "Personality disorders", abbreviation: "Pending", detail: "Screen for personality disorder symptoms" },
];

export function candidateByCode(code: string): ScreeningCandidate | null {
  return SCREENING_CANDIDATES.find((item) => item.code === code) ?? null;
}
