import { createHmac, timingSafeEqual } from "node:crypto";

const PAYABLE = new Set(["PENDING", "REQUIRES_ACTION"]);

export function currenciesMatch(left: string, right: string): boolean {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

export function paymentAmountsMatch(input: {
  paymentAmountMinor: number;
  appointmentFeeMinor: number;
  paymentCurrency: string;
  appointmentCurrency: string;
}): boolean {
  return (
    Number.isSafeInteger(input.paymentAmountMinor) &&
    input.paymentAmountMinor >= 0 &&
    input.paymentAmountMinor === input.appointmentFeeMinor &&
    currenciesMatch(input.paymentCurrency, input.appointmentCurrency)
  );
}

export type ConfirmDecision =
  | { ok: true; action: "already_recorded" | "confirm_appointment_only" | "confirm_and_mark_paid" }
  | { ok: false; code: "NOT_FOUND" | "AMOUNT_MISMATCH" | "PAYMENT_NOT_PAYABLE" | "LATE_PAYMENT_NEEDS_REVIEW" };

/** Server-side decision for turning a verified provider payment into a confirmed visit. */
export function decidePaymentConfirmation(input: {
  appointmentFound: boolean;
  paymentFound: boolean;
  paymentAppointmentId: string;
  appointmentId: string;
  appointmentStatus: string;
  paymentStatus: string;
  holdExpiresAt: Date | null;
  now: Date;
  paymentAmountMinor: number;
  appointmentFeeMinor: number;
  paymentCurrency: string;
  appointmentCurrency: string;
}): ConfirmDecision {
  if (!input.appointmentFound || !input.paymentFound || input.paymentAppointmentId !== input.appointmentId) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (
    !paymentAmountsMatch({
      paymentAmountMinor: input.paymentAmountMinor,
      appointmentFeeMinor: input.appointmentFeeMinor,
      paymentCurrency: input.paymentCurrency,
      appointmentCurrency: input.appointmentCurrency,
    })
  ) {
    return { ok: false, code: "AMOUNT_MISMATCH" };
  }

  const paid = input.paymentStatus === "PAID";
  if (input.appointmentStatus === "CONFIRMED" && paid) return { ok: true, action: "already_recorded" };
  if (input.appointmentStatus === "CONFIRMED") return { ok: false, code: "PAYMENT_NOT_PAYABLE" };

  const holdOpen = input.holdExpiresAt !== null && input.holdExpiresAt.getTime() > input.now.getTime();
  if (input.appointmentStatus !== "PENDING_PAYMENT" || !holdOpen) {
    return { ok: false, code: "LATE_PAYMENT_NEEDS_REVIEW" };
  }
  if (paid) return { ok: true, action: "confirm_appointment_only" };
  if (PAYABLE.has(input.paymentStatus)) return { ok: true, action: "confirm_and_mark_paid" };
  return { ok: false, code: "PAYMENT_NOT_PAYABLE" };
}

/**
 * Provider events may repeat or arrive out of order.
 * A paid or refunded payment is not moved backwards by a later failure or a duplicate success.
 */
export function nextProviderPaymentStatus(
  current: string,
  incoming: string,
): { status: string; changed: boolean } | { rejected: true } {
  if (current === incoming) return { status: current, changed: false };
  if (current === "PAID" && (incoming === "REFUNDED" || incoming === "PARTIALLY_REFUNDED")) {
    return { status: incoming, changed: true };
  }
  if (current === "PAID" || current === "REFUNDED" || current === "PARTIALLY_REFUNDED") {
    return { status: current, changed: false };
  }
  if ((current === "FAILED" || current === "CANCELLED") && incoming === "PAID") return { rejected: true };
  if (
    (current === "PENDING" || current === "REQUIRES_ACTION") &&
    (incoming === "PAID" || incoming === "FAILED" || incoming === "CANCELLED" || incoming === "REQUIRES_ACTION" || incoming === "PENDING")
  ) {
    return { status: incoming, changed: true };
  }
  return { rejected: true };
}

export function verifyProviderSignature(input: { body: string; header: string | null; secret: string | null }): boolean {
  const secret = input.secret?.trim() ?? "";
  const header = input.header?.trim() ?? "";
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(input.body).digest("hex");
  const provided = (header.startsWith("sha256=") ? header.slice("sha256=".length) : header).toLowerCase();
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
