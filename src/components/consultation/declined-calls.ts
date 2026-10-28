const KEY = "carecircle-declined-calls";

export function declinedCallIds(): string[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is string => typeof item === "string").slice(-30);
  } catch {
    return [];
  }
}

export function rememberDeclinedCall(callId: string) {
  const next = [...declinedCallIds().filter((id) => id !== callId), callId].slice(-30);
  sessionStorage.setItem(KEY, JSON.stringify(next));
}
