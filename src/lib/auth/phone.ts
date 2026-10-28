const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Normalize a phone number to E.164.
 * Numbers with a leading + are accepted as international.
 * A leading 0 and eight more digits is treated as a Sierra Leone number.
 */
export function normalizePhone(input: string): string | null {
  const compact = input.trim().replace(/[\s().-]/g, "");
  if (!compact) {
    return null;
  }

  let candidate = compact;
  if (candidate.startsWith("00")) {
    candidate = `+${candidate.slice(2)}`;
  } else if (candidate.startsWith("0") && /^0\d{8}$/.test(candidate)) {
    candidate = `+232${candidate.slice(1)}`;
  } else if (/^232\d{8}$/.test(candidate)) {
    candidate = `+${candidate}`;
  } else if (!candidate.startsWith("+") && /^\d{8,15}$/.test(candidate)) {
    return null;
  }

  return E164.test(candidate) ? candidate : null;
}
