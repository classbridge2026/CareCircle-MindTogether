import { describe, expect, it } from "vitest";
import {
  afrimoneyConfigured,
  appOrigin,
  majorUnitsFromMinor,
  mapWalletStatus,
  normalizeSierraLeoneMsisdn,
  orangeConfigured,
  orangeOrderId,
} from "./mobile-money";

describe("mobile money helpers", () => {
  it("keeps a Sierra Leone number as 232 plus 8 digits", () => {
    expect(normalizeSierraLeoneMsisdn("+232 74 604 922")).toBe("23274604922");
    expect(normalizeSierraLeoneMsisdn("074604922")).toBe("23274604922");
    expect(normalizeSierraLeoneMsisdn("123")).toBeNull();
    expect(normalizeSierraLeoneMsisdn("01234567")).toBeNull();
  });

  it("turns stored minor units into major units", () => {
    expect(majorUnitsFromMinor(1550)).toBe(15.5);
    expect(majorUnitsFromMinor(0)).toBeNull();
  });

  it("builds an Orange order id inside the 30 character limit", () => {
    expect(orangeOrderId("43284dbd-0716-4f0b-8a38-c10f3484a354")).toBe("43284dbd07164f0b8a38");
  });

  it("maps wallet statuses and refuses an unknown one", () => {
    expect(mapWalletStatus("successful")).toBe("PAID");
    expect(mapWalletStatus("EXPIRED")).toBe("FAILED");
    expect(mapWalletStatus("nope")).toBeNull();
  });

  it("refuses a charge until the merchant keys exist", () => {
    expect(orangeConfigured({})).toBe(false);
    expect(orangeConfigured({ ORANGE_MONEY_CLIENT_ID: "a", ORANGE_MONEY_CLIENT_SECRET: "b", ORANGE_MONEY_MERCHANT_KEY: "c" })).toBe(true);
    expect(afrimoneyConfigured({ AFRIMONEY_API_BASE: "https://pay.example" })).toBe(false);
    expect(appOrigin({ NODE_ENV: "production" })).toBe("");
    expect(appOrigin({ APP_BASE_URL: "https://care.example/app" })).toBe("https://care.example");
  });
});
