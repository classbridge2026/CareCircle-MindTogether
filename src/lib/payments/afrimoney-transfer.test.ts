import { describe, expect, it } from "vitest";
import { afrimoneyDialHref, afrimoneySteps } from "./afrimoney-transfer";

describe("Afrimoney phone transfer", () => {
  it("follows the Africell *161# menu and leaves the PIN on the phone", () => {
    expect(afrimoneyDialHref()).toBe(`tel:${encodeURIComponent("*161#")}`);
    expect(afrimoneyDialHref()).not.toContain("PIN");
    expect(afrimoneySteps("077 604 922", "50")).toEqual([
      "Dial *161#",
      "Choose 1, Transfer money",
      "Choose 1, Transfer to a registered number",
      "Enter 077 604 922",
      "Enter 50",
      "Check the name, then enter your PIN on the phone",
    ]);
  });
});
