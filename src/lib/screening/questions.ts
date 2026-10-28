import { parseScoringSpec, type ScoringBand, type ScoringSpec, type ScreeningItem } from "./scoring";

export const AUTOMATIC_SUM_ALGORITHM = "auto-sum-total-1";
export const UPLOADED_SUM_ALGORITHM = "uploaded-sum-1";
export const AUTOMATIC_BAND_LABEL = "Numeric total";

const TREATMENT_LABEL = /\b(medications?|medicines?|pharmacotherap\w*|prescri\w*)\b/i;

export type EditorChoice = { value: string; label: string };

export type EditorQuestion = {
  prompt: string;
  choices: EditorChoice[];
  safety: boolean;
  safetyAtLeast: string;
};

export type EditorBand = { min: string; max: string; label: string };

export type EditorState = {
  questions: EditorQuestion[];
  bands: EditorBand[];
  mode: "automatic" | "uploaded" | "none";
};

export type PreparedQuestions = {
  items: ScreeningItem[];
  spec: ScoringSpec;
  algorithmVersion: string;
  mode: "automatic" | "uploaded";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function whole(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function choiceBounds(item: ScreeningItem): { min: number; max: number } {
  const values = item.choices.map((choice) => choice.value);
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function nextQuestionVersion(existing: string[]): string {
  let major = 1;
  let minor = -1;
  for (const value of existing) {
    const match = /^(\d+)\.(\d+)$/.exec(value.trim());
    if (!match) continue;
    const nextMajor = Number(match[1]);
    const nextMinor = Number(match[2]);
    if (nextMajor > major || (nextMajor === major && nextMinor > minor)) {
      major = nextMajor;
      minor = nextMinor;
    }
  }
  let candidate = `${major}.${minor + 1}`;
  while (existing.includes(candidate)) {
    minor += 1;
    candidate = `${major}.${minor + 1}`;
  }
  return candidate;
}

export function bandsCoverSums(spec: ScoringSpec): boolean {
  const minScore = spec.items.reduce((sum, item) => sum + item.min, 0);
  const maxScore = spec.items.reduce((sum, item) => sum + item.max, 0);
  if (spec.bands.length === 0 || spec.bands[0].min !== minScore || spec.bands[spec.bands.length - 1].max !== maxScore) return false;
  for (let index = 1; index < spec.bands.length; index += 1) {
    if (spec.bands[index].min !== spec.bands[index - 1].max + 1) return false;
  }
  return true;
}

function treatmentLabel(label: string): boolean {
  return TREATMENT_LABEL.test(label);
}

function questionsFromUnknown(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;
  if (Array.isArray(value.questions)) return value.questions;
  if (Array.isArray(value.items)) return value.items;
  return null;
}

function toEditorQuestion(entry: unknown, safetyAtLeast: number | null): EditorQuestion | null {
  if (!isRecord(entry)) return null;
  const prompt = text(entry.prompt);
  if (!Array.isArray(entry.choices) || entry.choices.length < 2 || entry.choices.length > 8) return null;
  const choices: EditorChoice[] = [];
  for (const choice of entry.choices) {
    if (!isRecord(choice)) return null;
    const value = whole(choice.value);
    const label = text(choice.label);
    if (value === null || value < 0 || value > 20 || !label || label.length > 120) return null;
    choices.push({ value: String(value), label });
  }
  return {
    prompt,
    choices,
    safety: safetyAtLeast !== null,
    safetyAtLeast: safetyAtLeast === null ? "" : String(safetyAtLeast),
  };
}

export function editorStateFromStored(items: unknown, spec: unknown, algorithm: string | null): EditorState {
  const parsedItems = Array.isArray(items) ? items : [];
  const parsedSpec = parseScoringSpec(spec);
  const safetyIndex = parsedSpec?.safety?.itemIndex ?? null;
  const safetyAtLeast = parsedSpec?.safety?.whenAtLeast ?? null;
  const questions: EditorQuestion[] = [];
  for (const entry of parsedItems) {
    if (!isRecord(entry)) continue;
    const index = whole(entry.index);
    const question = toEditorQuestion(entry, index !== null && index === safetyIndex ? safetyAtLeast : null);
    if (question) questions.push(question);
  }
  const automatic = algorithm === AUTOMATIC_SUM_ALGORITHM || (parsedSpec?.bands.length === 1 && parsedSpec.bands[0].label === AUTOMATIC_BAND_LABEL);
  const bands = !parsedSpec || automatic
    ? []
    : parsedSpec.bands.map((band) => ({ min: String(band.min), max: String(band.max), label: band.label }));
  return {
    questions,
    bands,
    mode: questions.length === 0 ? "none" : automatic || bands.length === 0 ? "automatic" : "uploaded",
  };
}

export function importQuestionFile(value: unknown): { ok: true; state: EditorState } | { ok: false; message: string } {
  const raw = questionsFromUnknown(value);
  if (!raw) return { ok: false, message: "The file needs a list of questions." };
  if (raw.length < 1 || raw.length > 40) return { ok: false, message: "Upload between 1 and 40 questions." };
  const scoring = isRecord(value) && isRecord(value.scoring) ? value.scoring : isRecord(value) && isRecord(value.scoringSpec) ? value.scoringSpec : null;
  const safety = scoring && isRecord(scoring.safety) ? scoring.safety : null;
  const safetyIndex = safety ? whole(safety.itemIndex) ?? (whole(safety.question) !== null ? (whole(safety.question) as number) - 1 : null) : null;
  const safetyAtLeast = safety ? whole(safety.whenAtLeast) : null;
  const questions: EditorQuestion[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const question = toEditorQuestion(raw[index], safetyIndex === index ? safetyAtLeast : null);
    if (!question || question.prompt.length < 3) return { ok: false, message: `Question ${index + 1} could not be read.` };
    questions.push(question);
  }
  const rawBands = scoring && Array.isArray(scoring.bands) ? scoring.bands : [];
  const bands: EditorBand[] = [];
  for (const band of rawBands) {
    if (!isRecord(band)) return { ok: false, message: "A scoring band could not be read." };
    const min = whole(band.min);
    const max = whole(band.max);
    const label = text(band.label);
    if (min === null || max === null || !label) return { ok: false, message: "Each scoring band needs a minimum, a maximum, and a label." };
    bands.push({ min: String(min), max: String(max), label });
  }
  const automatic = bands.length === 1 && bands[0].label === AUTOMATIC_BAND_LABEL;
  return {
    ok: true,
    state: { questions, bands: automatic ? [] : bands, mode: automatic || bands.length === 0 ? "automatic" : "uploaded" },
  };
}

export function prepareQuestionSet(input: { questions: unknown; bands: unknown }): { ok: true; prepared: PreparedQuestions } | { ok: false; message: string } {
  if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 40) {
    return { ok: false, message: "Add between 1 and 40 questions." };
  }
  const items: ScreeningItem[] = [];
  let safety: ScoringSpec["safety"] = null;
  for (let index = 0; index < input.questions.length; index += 1) {
    const entry = input.questions[index];
    if (!isRecord(entry)) return { ok: false, message: `Question ${index + 1} could not be read.` };
    const prompt = text(entry.prompt);
    if (prompt.length < 3 || prompt.length > 500) return { ok: false, message: `Question ${index + 1} needs a prompt between 3 and 500 characters.` };
    if (!Array.isArray(entry.choices) || entry.choices.length < 2 || entry.choices.length > 8) {
      return { ok: false, message: `Question ${index + 1} needs between 2 and 8 answers.` };
    }
    const choices: ScreeningItem["choices"] = [];
    const seen = new Set<number>();
    for (const choice of entry.choices) {
      if (!isRecord(choice)) return { ok: false, message: `Question ${index + 1} has an answer that could not be read.` };
      const value = whole(choice.value);
      const label = text(choice.label);
      if (value === null || value < 0 || value > 20 || seen.has(value) || label.length < 1 || label.length > 120) {
        return { ok: false, message: `Question ${index + 1} needs distinct answer scores from 0 to 20 and a label for each answer.` };
      }
      seen.add(value);
      choices.push({ value, label });
    }
    const marked = entry.safety === true || entry.safety === "true";
    if (marked) {
      if (safety) return { ok: false, message: "Only one question can raise the safety flag." };
      const whenAtLeast = whole(entry.safetyAtLeast);
      const bounds = { min: Math.min(...choices.map((choice) => choice.value)), max: Math.max(...choices.map((choice) => choice.value)) };
      if (whenAtLeast === null || whenAtLeast < bounds.min || whenAtLeast > bounds.max) {
        return { ok: false, message: `Question ${index + 1} needs a safety threshold inside its answer scores.` };
      }
      safety = { itemIndex: index, whenAtLeast };
    }
    items.push({ index, prompt, choices });
  }

  const scoredItems = items.map((item) => ({ index: item.index, ...choiceBounds(item) }));
  const uploadedBands = Array.isArray(input.bands) ? input.bands : [];
  let bands: ScoringBand[];
  let mode: PreparedQuestions["mode"];
  if (uploadedBands.length === 0) {
    const minScore = scoredItems.reduce((sum, item) => sum + item.min, 0);
    const maxScore = scoredItems.reduce((sum, item) => sum + item.max, 0);
    bands = [{ min: minScore, max: maxScore, label: AUTOMATIC_BAND_LABEL }];
    mode = "automatic";
  } else {
    if (uploadedBands.length > 12) return { ok: false, message: "Use no more than 12 scoring bands." };
    bands = [];
    for (let index = 0; index < uploadedBands.length; index += 1) {
      const band = uploadedBands[index];
      if (!isRecord(band)) return { ok: false, message: `Scoring band ${index + 1} could not be read.` };
      const min = whole(band.min);
      const max = whole(band.max);
      const label = text(band.label);
      if (min === null || max === null || min < 0 || max < min || label.length < 1 || label.length > 80) {
        return { ok: false, message: `Scoring band ${index + 1} needs a minimum, a maximum, and a label.` };
      }
      if (treatmentLabel(label)) return { ok: false, message: "A scoring label cannot recommend medication or treatment." };
      bands.push({ min, max, label });
    }
    mode = "uploaded";
  }

  const spec = parseScoringSpec({ kind: "SUM", items: scoredItems, bands, safety });
  if (!spec || !bandsCoverSums(spec)) {
    return { ok: false, message: "Scoring bands must cover every possible total without gaps or overlaps." };
  }
  return {
    ok: true,
    prepared: {
      items,
      spec,
      algorithmVersion: mode === "automatic" ? AUTOMATIC_SUM_ALGORITHM : UPLOADED_SUM_ALGORITHM,
      mode,
    },
  };
}
