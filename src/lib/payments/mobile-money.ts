export const ORANGE_MONEY = "ORANGE_MONEY";
export const AFRIMONEY = "AFRIMONEY";

export type WalletProvider = typeof ORANGE_MONEY | typeof AFRIMONEY;

const ORANGE_STATUS: Record<string, "PAID" | "FAILED" | "REQUIRES_ACTION" | "PENDING"> = {
  SUCCESS: "PAID",
  SUCCESSFUL: "PAID",
  FAILED: "FAILED",
  EXPIRED: "FAILED",
  CANCELLED: "FAILED",
  CANCELED: "FAILED",
  PENDING: "REQUIRES_ACTION",
  INITIATED: "REQUIRES_ACTION",
};

export function isWalletProvider(value: string): value is WalletProvider {
  return value === ORANGE_MONEY || value === AFRIMONEY;
}

export function walletLabel(provider: WalletProvider) {
  return provider === ORANGE_MONEY ? "Orange Money" : "Afrimoney";
}

/** Sierra Leone mobile number as 232 followed by 8 digits. */
export function normalizeSierraLeoneMsisdn(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const local = digits.startsWith("232") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  if (!/^[1-9]\d{7}$/.test(local)) return null;
  return `232${local}`;
}

export function majorUnitsFromMinor(minor: number): number | null {
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor % 1 !== 0) return null;
  const major = minor / 100;
  if (!Number.isFinite(major) || major <= 0) return null;
  return major;
}

export function orangeOrderId(paymentId: string): string {
  return paymentId.replace(/-/g, "").slice(0, 20);
}

export function mapWalletStatus(raw: string): "PAID" | "FAILED" | "REQUIRES_ACTION" | "PENDING" | null {
  const key = raw.trim().toUpperCase();
  return ORANGE_STATUS[key] ?? null;
}

export function orangeConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.ORANGE_MONEY_CLIENT_ID?.trim() && env.ORANGE_MONEY_CLIENT_SECRET?.trim() && env.ORANGE_MONEY_MERCHANT_KEY?.trim());
}

export function afrimoneyConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.AFRIMONEY_API_BASE?.trim() && env.AFRIMONEY_API_KEY?.trim() && env.AFRIMONEY_CALLBACK_SECRET?.trim());
}

export function appOrigin(env: Record<string, string | undefined> = process.env) {
  const raw = env.APP_BASE_URL?.trim().replace(/\/$/, "") ?? "";
  if (!raw) return env.NODE_ENV === "production" ? "" : "http://localhost:3000";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.origin;
  } catch {
    return "";
  }
}
