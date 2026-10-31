import { timingSafeEqual } from "node:crypto";
import { PaymentStatus, type PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseUuid } from "@/lib/catalog/rules";
import { confirmVerifiedPayment } from "@/lib/appointments/payment-holds";
import { decimalToMinorUnits, parseCurrency, parseMoney } from "@/lib/catalog/money";
import { nextProviderPaymentStatus, paymentAmountsMatch } from "./verification";
import {
  AFRIMONEY,
  ORANGE_MONEY,
  isWalletProvider,
  mapWalletStatus,
  normalizeSierraLeoneMsisdn,
  orangeOrderId,
  type WalletProvider,
  walletLabel,
} from "./mobile-money";
import { checkAfrimoneyPayment, checkOrangePayment, startWalletPayment } from "./wallet-client";

type Db = PrismaClient;

export type PayState = { message?: string; paymentUrl?: string };

function refresh(appointmentId: string) {
  revalidatePath(`/patient/appointments/${appointmentId}`);
  revalidatePath("/patient/payments");
  revalidatePath("/patient");
  revalidatePath("/admin/payments");
}

function payloadObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function beginVisitPayment(
  input: { actorUserId: string; appointmentId: string; provider: string; phone: string },
  db: Db,
): Promise<PayState> {
  const appointmentId = parseUuid(input.appointmentId);
  if (!appointmentId || !isWalletProvider(input.provider)) return { message: "Choose Orange Money or Afrimoney." };
  const phone = normalizeSierraLeoneMsisdn(input.phone);
  if (!phone) return { message: "Enter the Sierra Leone number for that wallet." };
  const provider = input.provider;

  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId, patient: { userId: input.actorUserId } },
    select: { id: true, status: true, feeAmountMinor: true, currency: true },
  });
  if (!appointment) return { message: "This visit could not be found." };
  if (appointment.status !== "CONFIRMED" && appointment.status !== "PENDING_PAYMENT") {
    return { message: "Pay after the doctor approves the visit." };
  }
  if (appointment.feeAmountMinor <= 0) return { message: "This visit does not have a fee." };

  const paid = await db.payment.findFirst({
    where: { appointmentId, status: "PAID" },
    select: { id: true },
  });
  if (paid) return { message: "This visit is already paid." };

  const payment = await db.payment.create({
    data: {
      appointmentId,
      payerUserId: input.actorUserId,
      amountMinor: appointment.feeAmountMinor,
      currency: appointment.currency,
      status: PaymentStatus.PENDING,
      providerCode: provider,
    },
    select: { id: true },
  });
  const orderId = provider === ORANGE_MONEY ? orangeOrderId(payment.id) : payment.id;
  await db.payment.update({ where: { id: payment.id }, data: { providerReference: orderId } });

  let started;
  try {
    started = await startWalletPayment({
      provider,
      paymentId: payment.id,
      appointmentId,
      amountMinor: appointment.feeAmountMinor,
      currency: appointment.currency,
      phone,
    });
  } catch {
    started = { ok: false as const, message: `${walletLabel(provider)} could not be reached.` };
  }
  if (!started.ok) {
    await db.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
    return { message: started.message };
  }

  await db.paymentEvent.create({
    data: {
      paymentId: payment.id,
      providerCode: provider,
      providerEventId: `start:${orderId}`,
      status: PaymentStatus.REQUIRES_ACTION,
      payloadSummary: {
        orderId,
        payToken: started.payToken,
        notifToken: started.notifToken,
        paymentUrl: started.paymentUrl,
      },
    },
  });
  await db.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.REQUIRES_ACTION } });
  refresh(appointmentId);
  if (started.paymentUrl) return { paymentUrl: started.paymentUrl, message: `Continue in ${walletLabel(provider)}.` };
  return { message: `Afrimoney sent a prompt to ${phone}. Approve it on the phone, then choose Check payment.` };
}

async function openWallet(db: Db, paymentId: string) {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      appointmentId: true,
      providerCode: true,
      providerReference: true,
      amountMinor: true,
      currency: true,
      status: true,
      events: { where: { providerEventId: { startsWith: "start:" } }, orderBy: { occurredAt: "desc" }, take: 1, select: { payloadSummary: true } },
    },
  });
  const providerCode = payment?.providerCode ?? "";
  const providerReference = payment?.providerReference ?? "";
  if (!payment || !providerReference || !isWalletProvider(providerCode)) return null;
  const payload = payloadObject(payment.events[0]?.payloadSummary);
  return {
    payment: { ...payment, providerCode, providerReference },
    payToken: text(payload.payToken),
    notifToken: text(payload.notifToken),
  };
}

export async function applyWalletResult(
  input: {
    provider: WalletProvider;
    orderId: string;
    rawStatus: string;
    eventId: string;
    notifToken?: string | null;
    reportedMinor?: number | null;
    reportedCurrency?: string | null;
  },
  db: Db,
): Promise<{ ok: true; appointmentId: string } | { ok: false; message: string }> {
  const incoming = mapWalletStatus(input.rawStatus);
  if (!incoming) return { ok: false, message: "The wallet status was not recognised." };
  const payment = await db.payment.findUnique({
    where: { providerCode_providerReference: { providerCode: input.provider, providerReference: input.orderId } },
    select: {
      id: true,
      appointmentId: true,
      status: true,
      amountMinor: true,
      currency: true,
      providerCode: true,
      appointment: { select: { status: true, feeAmountMinor: true, currency: true } },
      events: { where: { providerEventId: { startsWith: "start:" } }, take: 1, select: { payloadSummary: true } },
    },
  });
  if (!payment) return { ok: false, message: "That payment was not found." };
  if (input.provider === ORANGE_MONEY && input.notifToken !== undefined) {
    const stored = text(payloadObject(payment.events[0]?.payloadSummary).notifToken);
    const given = input.notifToken ?? "";
    const left = Buffer.from(stored);
    const right = Buffer.from(given);
    if (!stored || left.length !== right.length || !timingSafeEqual(left, right)) {
      return { ok: false, message: "The Orange Money notice did not match this payment." };
    }
  }
  if (input.reportedMinor != null && input.reportedMinor !== payment.amountMinor) {
    return { ok: false, message: "The paid amount does not match the visit fee." };
  }
  const reportedCurrency = input.reportedCurrency?.trim().toUpperCase() ?? "";
  const storedCurrency = payment.currency.trim().toUpperCase();
  const orangeCurrency = process.env.ORANGE_MONEY_CURRENCY?.trim().toUpperCase() ?? "";
  if (reportedCurrency && reportedCurrency !== storedCurrency && reportedCurrency !== orangeCurrency) {
    return { ok: false, message: "The paid amount does not match the visit fee." };
  }
  if (
    !paymentAmountsMatch({
      paymentAmountMinor: payment.amountMinor,
      appointmentFeeMinor: payment.appointment.feeAmountMinor,
      paymentCurrency: payment.currency,
      appointmentCurrency: payment.appointment.currency,
    })
  ) {
    return { ok: false, message: "The paid amount does not match the visit fee." };
  }
  const next = nextProviderPaymentStatus(payment.status, incoming);
  if ("rejected" in next) return { ok: false, message: "This payment can no longer take that status." };
  if (!next.changed) return { ok: true, appointmentId: payment.appointmentId };

  if (incoming === "PAID" && payment.appointment.status === "PENDING_PAYMENT") {
    const confirmed = await confirmVerifiedPayment({ appointmentId: payment.appointmentId, paymentId: payment.id }, db);
    if (!confirmed.ok) return { ok: false, message: "The payment arrived after the hold closed." };
    refresh(payment.appointmentId);
    return { ok: true, appointmentId: payment.appointmentId };
  }

  await db.payment.update({ where: { id: payment.id }, data: { status: next.status as PaymentStatus } });
  await db.paymentEvent.create({
    data: {
      paymentId: payment.id,
      providerCode: input.provider,
      providerEventId: input.eventId.slice(0, 120),
      status: next.status as PaymentStatus,
      payloadSummary: { source: "wallet", rawStatus: input.rawStatus },
    },
  }).catch(() => undefined);
  refresh(payment.appointmentId);
  return { ok: true, appointmentId: payment.appointmentId };
}

export async function refreshVisitPayment(input: { actorUserId: string; appointmentId: string }, db: Db): Promise<PayState> {
  const appointmentId = parseUuid(input.appointmentId);
  if (!appointmentId) return { message: "This visit could not be found." };
  const payment = await db.payment.findFirst({
    where: {
      appointmentId,
      payerUserId: input.actorUserId,
      providerCode: { in: [ORANGE_MONEY, AFRIMONEY] },
      status: { in: [PaymentStatus.PENDING, PaymentStatus.REQUIRES_ACTION] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!payment) return { message: "There is no wallet payment waiting for this visit." };
  const open = await openWallet(db, payment.id);
  if (!open) return { message: "There is no wallet payment waiting for this visit." };
  if (open.payment.providerCode === ORANGE_MONEY && !open.payToken) {
    return { message: "This transfer is waiting for the clinic to confirm it." };
  }

  let checked;
  try {
    checked = open.payment.providerCode === ORANGE_MONEY
      ? await checkOrangePayment({
          orderId: open.payment.providerReference,
          amountMinor: open.payment.amountMinor,
          payToken: open.payToken,
          currency: open.payment.currency,
        })
      : await checkAfrimoneyPayment({ paymentId: open.payment.id });
  } catch {
    return { message: "The wallet could not be reached. Try again in a moment." };
  }
  if (!checked.ok) return { message: checked.message };
  const applied = await applyWalletResult(
    {
      provider: open.payment.providerCode,
      orderId: open.payment.providerReference,
      rawStatus: checked.status,
      eventId: checked.eventId,
    },
    db,
  );
  if (!applied.ok) return { message: applied.message };
  if (mapWalletStatus(checked.status) === "PAID") return { message: "The payment is recorded." };
  if (mapWalletStatus(checked.status) === "FAILED") return { message: "The wallet did not complete the payment. You can try again." };
  return { message: "The wallet is still waiting for approval." };
}

export function reportedMinorUnits(amount: unknown, currency: unknown) {
  const money = typeof amount === "number" && Number.isFinite(amount) ? parseMoney(amount.toFixed(2)) : typeof amount === "string" ? parseMoney(amount) : null;
  const minor = money ? decimalToMinorUnits(money) : null;
  const code = typeof currency === "string" ? parseCurrency(currency, "") : null;
  return { minor, currency: code };
}

export async function orangeNotice(input: { orderId: string; status: string; notifToken: string; txnId: string; amount?: unknown; currency?: unknown }, db: Db) {
  const reported = reportedMinorUnits(input.amount, input.currency);
  return applyWalletResult(
    {
      provider: ORANGE_MONEY,
      orderId: input.orderId,
      rawStatus: input.status,
      eventId: input.txnId || `orange:${input.orderId}:${input.status}`,
      notifToken: input.notifToken,
      reportedMinor: reported.minor,
      reportedCurrency: reported.currency,
    },
    db,
  );
}

export async function afrimoneyNotice(input: { paymentId: string; status: string; eventId: string; amount?: unknown; currency?: unknown }, db: Db) {
  const payment = await db.payment.findFirst({
    where: { id: input.paymentId, providerCode: AFRIMONEY },
    select: { providerReference: true },
  });
  if (!payment?.providerReference) return { ok: false as const, message: "That payment was not found." };
  const reported = reportedMinorUnits(input.amount, input.currency);
  return applyWalletResult(
    {
      provider: AFRIMONEY,
      orderId: payment.providerReference,
      rawStatus: input.status,
      eventId: input.eventId,
      reportedMinor: reported.minor,
      reportedCurrency: reported.currency,
    },
    db,
  );
}
