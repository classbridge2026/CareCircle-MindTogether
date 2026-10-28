import { normalizeEmail } from "./email-address";
import { normalizePhone } from "./phone";

export function loginIdentifierError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Enter an email address or phone number.";
  }
  if (!normalizeEmail(trimmed) && !normalizePhone(trimmed)) {
    return "Enter a valid email address or phone number.";
  }
  return null;
}
