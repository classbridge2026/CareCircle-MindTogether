export type ScreeningChoice = { value: number; label: string };

export type ScreeningItem = {
  index: number;
  prompt: string;
  choices: ScreeningChoice[];
};

export type ScoringBand = { min: number; max: number; label: string };

export type ScoringSpec = {
  kind: "SUM";
  items: Array<{ index: number; min: number; max: number }>;
  bands: ScoringBand[];
  safety?: { itemIndex: number; whenAtLeast: number } | null;
};

export type ScreeningScore = {
  score: number;
  maxScore: number;
  band: string;
  safetyFlag: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export function parseItems(value: unknown): ScreeningItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) return null;
  const items: ScreeningItem[] = [];
  const seen = new Set<number>();
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const index = integer(entry.index);
    const prompt = typeof entry.prompt === "string" ? entry.prompt.trim() : "";
    if (index === null || index < 0 || index > 39 || seen.has(index) || prompt.length < 3 || prompt.length > 500) return null;
    if (!Array.isArray(entry.choices) || entry.choices.length < 2 || entry.choices.length > 8) return null;
    const choices: ScreeningChoice[] = [];
    const values = new Set<number>();
    for (const choice of entry.choices) {
      if (!isRecord(choice)) return null;
      const choiceValue = integer(choice.value);
      const label = typeof choice.label === "string" ? choice.label.trim() : "";
      if (choiceValue === null || choiceValue < 0 || choiceValue > 20 || values.has(choiceValue) || label.length < 1 || label.length > 120) {
        return null;
      }
      values.add(choiceValue);
      choices.push({ value: choiceValue, label });
    }
    seen.add(index);
    items.push({ index, prompt, choices });
  }
  items.sort((left, right) => left.index - right.index);
  return items;
}

export function parseScoringSpec(value: unknown): ScoringSpec | null {
  if (!isRecord(value) || value.kind !== "SUM" || !Array.isArray(value.items) || !Array.isArray(value.bands)) return null;
  if (value.items.length === 0 || value.items.length > 40 || value.bands.length === 0 || value.bands.length > 12) return null;
  const items: ScoringSpec["items"] = [];
  const seen = new Set<number>();
  for (const entry of value.items) {
    if (!isRecord(entry)) return null;
    const index = integer(entry.index);
    const min = integer(entry.min);
    const max = integer(entry.max);
    if (index === null || min === null || max === null || index < 0 || min < 0 || max < min || max > 20 || seen.has(index)) return null;
    seen.add(index);
    items.push({ index, min, max });
  }
  items.sort((left, right) => left.index - right.index);
  const bands: ScoringBand[] = [];
  for (const entry of value.bands) {
    if (!isRecord(entry)) return null;
    const min = integer(entry.min);
    const max = integer(entry.max);
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    if (min === null || max === null || min < 0 || max < min || label.length < 1 || label.length > 80) return null;
    bands.push({ min, max, label });
  }
  bands.sort((left, right) => left.min - right.min);
  for (let i = 1; i < bands.length; i += 1) {
    if (bands[i].min <= bands[i - 1].max) return null;
  }
  let safety: ScoringSpec["safety"] = null;
  if (value.safety != null) {
    if (!isRecord(value.safety)) return null;
    const itemIndex = integer(value.safety.itemIndex);
    const whenAtLeast = integer(value.safety.whenAtLeast);
    if (itemIndex === null || whenAtLeast === null || !seen.has(itemIndex)) return null;
    safety = { itemIndex, whenAtLeast };
  }
  return { kind: "SUM", items, bands, safety };
}

export function scoreAssessment(spec: ScoringSpec, answers: number[]): ScreeningScore | null {
  if (answers.length !== spec.items.length) return null;
  let score = 0;
  let maxScore = 0;
  let safetyFlag = false;
  for (let position = 0; position < spec.items.length; position += 1) {
    const rule = spec.items[position];
    const answer = answers[position];
    if (!Number.isInteger(answer) || answer < rule.min || answer > rule.max) return null;
    score += answer;
    maxScore += rule.max;
    if (spec.safety && spec.safety.itemIndex === rule.index && answer >= spec.safety.whenAtLeast) safetyFlag = true;
  }
  const band = spec.bands.find((entry) => score >= entry.min && score <= entry.max);
  if (!band) return null;
  return { score, maxScore, band: band.label, safetyFlag };
}

export function answersMatchItems(items: ScreeningItem[], spec: ScoringSpec, answers: number[]): boolean {
  if (items.length !== spec.items.length || answers.length !== spec.items.length) return false;
  for (let position = 0; position < spec.items.length; position += 1) {
    const rule = spec.items[position];
    const item = items.find((entry) => entry.index === rule.index);
    if (!item) return false;
    if (item.choices.some((choice) => choice.value < rule.min || choice.value > rule.max)) return false;
    if (!item.choices.some((choice) => choice.value === answers[position])) return false;
  }
  return true;
}
