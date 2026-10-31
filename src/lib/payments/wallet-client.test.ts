import { describe, expect, it } from "vitest";
import { startWalletPayment } from "./wallet-client";

const env = {
  APP_BASE_URL: "https://care.example",
  ORANGE_MONEY_CLIENT_ID: "orange-client",
  ORANGE_MONEY_CLIENT_SECRET: "orange-secret",
  ORANGE_MONEY_MERCHANT_KEY: "merchant",
  ORANGE_MONEY_WEB_PATH: "orange-money-webpay/dev/v1",
  AFRIMONEY_API_BASE: "https://afri.example",
  AFRIMONEY_API_KEY: "afri-key",
  AFRIMONEY_CALLBACK_SECRET: "afri-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("wallet payment start", () => {
  it("does not call Orange when the merchant keys are missing", async () => {
    let called = false;
    const result = await startWalletPayment(
      { provider: "ORANGE_MONEY", paymentId: "43284dbd-0716-4f0b-8a38-c10f3484a354", appointmentId: "11111111-1111-4111-8111-111111111111", amountMinor: 1500, currency: "SLE", phone: "23274604922" },
        { env: { APP_BASE_URL: "https://care.example" }, fetch: async () => { called = true; return json({}); } },
    );
    expect(result.ok).toBe(false);
    expect(called).toBe(false);
  });

  it("asks Orange for a payment page and keeps the return on this site", async () => {
    const seen: Array<{ url: string; body: string }> = [];
    const result = await startWalletPayment(
      { provider: "ORANGE_MONEY", paymentId: "43284dbd-0716-4f0b-8a38-c10f3484a354", appointmentId: "11111111-1111-4111-8111-111111111111", amountMinor: 1500, currency: "SLE", phone: "23274604922" },
      {
        env,
        fetch: async (url, init) => {
          seen.push({ url: String(url), body: String(init?.body ?? "") });
          if (String(url).includes("oauth")) return json({ access_token: "token", expires_in: 3600 });
          return json({ payment_url: "https://pay.orange.example/checkout", pay_token: "pay", notif_token: "notice" });
        },
      },
    );
    expect(result).toMatchObject({ ok: true, paymentUrl: "https://pay.orange.example/checkout", orderId: "43284dbd07164f0b8a38" });
    const payment = JSON.parse(seen[1]?.body ?? "{}") as { amount: number; return_url: string; notif_url: string };
    expect(payment.amount).toBe(15);
    expect(payment.return_url).toBe("https://care.example/pay/orange?a=11111111-1111-4111-8111-111111111111");
    expect(payment.notif_url).toBe("https://care.example/api/payments/orange");
  });

  it("treats an Afrimoney prompt as started only after the accepted response", async () => {
    const result = await startWalletPayment(
      { provider: "AFRIMONEY", paymentId: "22222222-2222-4222-8222-222222222222", appointmentId: "11111111-1111-4111-8111-111111111111", amountMinor: 2000, currency: "SLE", phone: "23274604922" },
      { env, fetch: async () => json({}, 202) },
    );
    expect(result).toMatchObject({ ok: true, paymentUrl: null, orderId: "22222222-2222-4222-8222-222222222222" });
  });
});
