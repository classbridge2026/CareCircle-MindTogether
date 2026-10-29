import type { GuideFeature } from "./guide-features";

export type GuidePrediction = { featureId: string; margin: number };

type Row = { featureId: string; text: string };

const STOP = new Set([
  "a", "an", "the", "to", "of", "and", "or", "for", "in", "on", "is", "are", "was", "be", "do", "does", "did",
  "can", "i", "you", "me", "my", "we", "our", "what", "how", "where", "when", "why", "who", "please", "tell",
  "about", "with", "from", "this", "that", "it", "its", "page", "tab", "screen", "portal", "admin", "not",
  "no", "yes", "just", "into", "than", "then", "so", "if", "at", "by", "as", "but", "they", "them", "your",
  "have", "has", "will", "would", "could", "should", "there", "here", "want", "need", "like", "get", "make",
]);

type Model = {
  idf: Map<string, number>;
  classTokens: Map<string, Set<string>>;
};

type Bucket = { baseRows: Row[]; features: GuideFeature[]; model: Model | null };

const buckets = new Map<string, Bucket>();

function bucket(audience = "admin") {
  let current = buckets.get(audience);
  if (!current) {
    current = { baseRows: [], features: [], model: null };
    buckets.set(audience, current);
  }
  return current;
}

function fold(word: string) {
  return word.endsWith("s") && word.length > 4 && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(fold)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

function rows(audience: string) {
  const current = bucket(audience);
  return [
    ...current.baseRows,
    ...current.features.flatMap((feature) => feature.examples.map((text) => ({ featureId: feature.id, text }))),
  ];
}

function train(audience: string): Model {
  const classTokens = new Map<string, Set<string>>();
  const docFreq = new Map<string, number>();
  for (const row of rows(audience)) {
    const tokens = new Set(tokenize(row.text));
    if (tokens.size === 0) continue;
    const bag = classTokens.get(row.featureId) ?? new Set<string>();
    for (const token of tokens) {
      if (bag.has(token)) continue;
      bag.add(token);
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
    classTokens.set(row.featureId, bag);
  }
  const classes = Math.max(classTokens.size, 1);
  const idf = new Map<string, number>();
  for (const [token, freq] of docFreq) idf.set(token, Math.log((classes + 1) / (freq + 1)) + 1);
  return { idf, classTokens };
}

function ready(audience: string) {
  const current = bucket(audience);
  if (!current.model) current.model = train(audience);
  return current.model;
}

export function learnPortalFeatures(next: Row[], audience = "admin") {
  const current = bucket(audience);
  current.baseRows = next;
  current.model = null;
}

export function addGuideFeatures(next: GuideFeature[], audience = "admin") {
  const current = bucket(audience);
  const ids = new Set(next.map((feature) => feature.id));
  current.features = [...current.features.filter((feature) => !ids.has(feature.id)), ...next];
  current.model = null;
}

export function resetGuideFeatures(audience = "admin") {
  const current = bucket(audience);
  current.features = [];
  current.model = null;
}

export function learnedGuideFeature(id: string, audience = "admin") {
  return bucket(audience).features.find((feature) => feature.id === id) ?? null;
}

export function predictGuideFeature(question: string, audience = "admin"): GuidePrediction | null {
  const current = ready(audience);
  const tokens = [...new Set(tokenize(question))].filter((token) => current.idf.has(token));
  if (tokens.length === 0) return null;
  const scored = [...current.classTokens.entries()].map(([featureId, bag]) => ({
    featureId,
    score: tokens.reduce((sum, token) => sum + (bag.has(token) ? (current.idf.get(token) ?? 0) : 0), 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  if (!best || best.score <= 0) return null;
  const margin = best.score - (second?.score ?? 0);
  if (margin < 0.75) return null;
  return { featureId: best.featureId, margin };
}
