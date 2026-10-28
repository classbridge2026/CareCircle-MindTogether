import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const DEV_PEPPER = "dev-only-carecircle-pepper";

export function verificationPepper(): string {
  const configured = process.env.VERIFICATION_PEPPER?.trim();
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("VERIFICATION_PEPPER is required in production.");
  }
  return DEV_PEPPER;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashSessionToken(token: string): string {
  return sha256Hex(token);
}

export function createEmailToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: sha256Hex(raw) };
}

export function hashEmailToken(raw: string): string {
  return sha256Hex(raw);
}

export function createPhoneCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Bound to the user so the same code does not match a different account. */
export function hashPhoneCode(userId: string, code: string, pepper = verificationPepper()): string {
  return createHmac("sha256", pepper).update(`${userId}:${code}`).digest("hex");
}

export function hashesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function hashIpAddress(ip: string, pepper = verificationPepper()): string {
  return createHmac("sha256", pepper).update(`ip:${ip}`).digest("hex");
}
