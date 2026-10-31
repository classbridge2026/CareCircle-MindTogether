import { describe, expect, it } from "vitest";
import { parseSupportFields } from "./request";

const valid = {
  email: " Person@Clinic.test ",
  category: "SIGN_IN",
  description: "I cannot sign in after resetting my password.",
};

describe("parseSupportFields", () => {
  it("accepts a complete account request", () => {
    expect(parseSupportFields(valid)).toEqual({
      ok: true,
      email: "person@clinic.test",
      category: "SIGN_IN",
      description: "I cannot sign in after resetting my password.",
    });
  });

  it("rejects a missing email, category, or description", () => {
    expect(parseSupportFields({ ...valid, email: "not-an-email" }).ok).toBe(false);
    expect(parseSupportFields({ ...valid, category: "BILLING" }).ok).toBe(false);
    expect(parseSupportFields({ ...valid, description: "too short" }).ok).toBe(false);
  });
});
