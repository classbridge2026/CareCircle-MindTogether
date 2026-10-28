const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 254 || !EMAIL_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed.toLowerCase();
}

export function displayEmail(input: string): string | null {
  const normalized = normalizeEmail(input);
  if (!normalized) {
    return null;
  }
  return input.trim();
}
