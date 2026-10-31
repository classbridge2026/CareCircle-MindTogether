import {
  AFRIMONEY,
  ORANGE_MONEY,
  afrimoneyConfigured,
  appOrigin,
  majorUnitsFromMinor,
  orangeConfigured,
  orangeOrderId,
  type WalletProvider,
} from "./mobile-money";

type FetchLike = typeof fetch;

export type WalletStart =
  | { ok: true; provider: WalletProvider; orderId: string; payToken: string | null; notifToken: string | null; paymentUrl: string | null }
  | { ok: false; message: string };

export type WalletCheck = { ok: true; status: string; eventId: string } | { ok: false; message: string };

let orangeToken: { id: string; value: string; until: number } | null = null;

function orangePath(env: Record<string, string | undefined>) {
  const set = env.ORANGE_MONEY_WEB_PATH?.trim().replace(/^\/+|\/+$/g, "") ?? "";
  if (set) return set;
  if (env.NODE_ENV === "production") return "";
  return "orange-money-webpay/dev/v1";
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stringField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

async function orangeAccessToken(fetcher: FetchLike, env: Record<string, string | undefined>) {
  const id = env.ORANGE_MONEY_CLIENT_ID?.trim() ?? "";
  if (orangeToken && orangeToken.id === id && orangeToken.until > Date.now() + 15_000) return orangeToken.value;
  const secret = env.ORANGE_MONEY_CLIENT_SECRET?.trim() ?? "";
  const response = await fetcher("https://api.orange.com/oauth/v3/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await readJson(response);
  const token = stringField(body, "access_token");
  const expires = Number(body.expires_in);
  if (!response.ok || !token) return "";
  orangeToken = { id, value: token, until: Date.now() + (Number.isFinite(expires) ? expires * 1000 : 60_000) };
  return token;
}

export async function startWalletPayment(
  input: { provider: WalletProvider; paymentId: string; appointmentId: string; amountMinor: number; currency: string; phone: string },
  deps: { fetch?: FetchLike; env?: Record<string, string | undefined> } = {},
): Promise<WalletStart> {
  const env = deps.env ?? process.env;
  const fetcher = deps.fetch ?? fetch;
  const origin = appOrigin(env);
  if (!origin) return { ok: false, message: "APP_BASE_URL must be set before a payment can start." };
  const amount = majorUnitsFromMinor(input.amountMinor);
  if (amount === null) return { ok: false, message: "This visit does not have a payable fee." };

  if (input.provider === ORANGE_MONEY) {
    if (!orangeConfigured(env)) return { ok: false, message: "Orange Money is not connected on this server yet." };
    const path = orangePath(env);
    if (!path) return { ok: false, message: "Set ORANGE_MONEY_WEB_PATH to the Orange Money web payment path." };
    const token = await orangeAccessToken(fetcher, env);
    if (!token) return { ok: false, message: "Orange Money did not accept the merchant login." };
    const orderId = orangeOrderId(input.paymentId);
    const currency = env.ORANGE_MONEY_CURRENCY?.trim() || input.currency;
    const response = await fetcher(`https://api.orange.com/${path}/webpayment`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        merchant_key: env.ORANGE_MONEY_MERCHANT_KEY?.trim(),
        currency,
        order_id: orderId,
        amount,
        return_url: `${origin}/pay/orange?a=${input.appointmentId}`,
        cancel_url: `${origin}/pay/orange?a=${input.appointmentId}&c=1`,
        notif_url: `${origin}/api/payments/orange`,
        lang: "en",
        reference: "CareCircle",
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = await readJson(response);
    const paymentUrl = stringField(body, "payment_url");
    const payToken = stringField(body, "pay_token");
    if (!response.ok || !paymentUrl.startsWith("https://") || !payToken) {
      return { ok: false, message: "Orange Money did not start the payment." };
    }
    return { ok: true, provider: ORANGE_MONEY, orderId, payToken, notifToken: stringField(body, "notif_token") || null, paymentUrl };
  }

  if (!afrimoneyConfigured(env)) return { ok: false, message: "Afrimoney is not connected on this server yet." };
  const base = env.AFRIMONEY_API_BASE?.trim().replace(/\/$/, "") ?? "";
  const response = await fetcher(`${base}/transactions/type/merchantpay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AFRIMONEY_API_KEY?.trim()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Reference-Id": input.paymentId,
      "X-Callback-Url": `${origin}/api/payments/afrimoney`,
      "X-Target-Environment": env.AFRIMONEY_ENVIRONMENT?.trim() || "production",
    },
    body: JSON.stringify({
      amount: amount.toFixed(2),
      currency: input.currency,
      externalId: input.paymentId,
      payer: { partyIdType: "MSISDN", partyId: input.phone },
      payerMessage: "CareCircle visit",
      payeeNote: "CareCircle visit",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status !== 202 && !response.ok) return { ok: false, message: "Afrimoney did not start the payment." };
  return { ok: true, provider: AFRIMONEY, orderId: input.paymentId, payToken: null, notifToken: null, paymentUrl: null };
}

export async function checkOrangePayment(
  input: { orderId: string; amountMinor: number; payToken: string; currency: string },
  deps: { fetch?: FetchLike; env?: Record<string, string | undefined> } = {},
): Promise<WalletCheck> {
  const env = deps.env ?? process.env;
  const fetcher = deps.fetch ?? fetch;
  if (!orangeConfigured(env)) return { ok: false, message: "Orange Money is not connected on this server yet." };
  const path = orangePath(env);
  if (!path) return { ok: false, message: "Set ORANGE_MONEY_WEB_PATH to the Orange Money web payment path." };
  const token = await orangeAccessToken(fetcher, env);
  if (!token) return { ok: false, message: "Orange Money did not accept the merchant login." };
  const amount = majorUnitsFromMinor(input.amountMinor);
  if (amount === null) return { ok: false, message: "This visit does not have a payable fee." };
  const response = await fetcher(`https://api.orange.com/${path}/transactionstatus`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      order_id: input.orderId,
      amount,
      pay_token: input.payToken,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJson(response);
  const status = stringField(body, "status");
  if (!response.ok || !status) return { ok: false, message: "Orange Money did not return the payment status." };
  return { ok: true, status, eventId: stringField(body, "txnid") || `${input.orderId}:${status}` };
}

export async function checkAfrimoneyPayment(
  input: { paymentId: string },
  deps: { fetch?: FetchLike; env?: Record<string, string | undefined> } = {},
): Promise<WalletCheck> {
  const env = deps.env ?? process.env;
  const fetcher = deps.fetch ?? fetch;
  if (!afrimoneyConfigured(env)) return { ok: false, message: "Afrimoney is not connected on this server yet." };
  const base = env.AFRIMONEY_API_BASE?.trim().replace(/\/$/, "") ?? "";
  const response = await fetcher(`${base}/transactions/${input.paymentId}`, {
    headers: {
      Authorization: `Bearer ${env.AFRIMONEY_API_KEY?.trim()}`,
      Accept: "application/json",
      "X-Target-Environment": env.AFRIMONEY_ENVIRONMENT?.trim() || "production",
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJson(response);
  const status = stringField(body, "status");
  if (!response.ok || !status) return { ok: false, message: "Afrimoney did not return the payment status." };
  return { ok: true, status, eventId: stringField(body, "financialTransactionId") || `${input.paymentId}:${status}` };
}
