import { describe, expect, it } from "vitest";
import { formatOrangeDialNumber, orangeDialNumber, orangeTransferCode, parseOrangeTransactionId, ussdAmount } from "./orange-transfer";

describe("Orange Money phone transfer", () => {
  it("builds the dial code from the clinic number and the visit amount", () => {
    expect(orangeDialNumber("+232 76 604 922")).toBe("076604922");
    expect(formatOrangeDialNumber("076604922")).toBe("076 604 922");
    expect(ussdAmount(5000)).toBe("50");
    expect(ussdAmount(1550)).toBe("15.50");
    expect(orangeTransferCode("076604922", "50")).toBe("#144*2*1*076604922*50*PIN#");
  });

  it("accepts an SMS transaction code and refuses a PIN", () => {
    expect(parseOrangeTransactionId(" pp12.345678 ")).toBe("PP12.345678");
    expect(parseOrangeTransactionId("1234")).toBeNull();
    expect(parseOrangeTransactionId("12")).toBeNull();
  });
});
