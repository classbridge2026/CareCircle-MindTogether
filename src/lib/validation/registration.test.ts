import { describe, expect, it } from "vitest";
import { composeInternationalPhone, formDataToRegistration, passwordRequirementResults, registrationSchema } from "./registration";

const valid = {
  fullName: "Aminata Kamara",
  gender: "FEMALE",
  dateOfBirth: "1995-04-12",
  nationality: "Sierra Leonean",
  phone: "076000001",
  email: "Aminata@Example.com",
  residentialAddress: "12 Wilberforce",
  password: "CorrectHorse12",
  confirmPassword: "CorrectHorse12",
  acceptTerms: true,
  acceptPrivacy: true,
  role: "ADMIN",
  status: "ACTIVE",
};

describe("registration schema", () => {
  it("accepts a registration and drops privileged fields", () => {
    const parsed = registrationSchema.parse(valid);
    expect(parsed.fullName).toBe("Aminata Kamara");
    expect(parsed.emailNormalized).toBe("aminata@example.com");
    expect(parsed.phoneE164).toBe("+23276000001");
    expect(parsed).not.toHaveProperty("confirmPassword");
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("status");
    expect(parsed.dateOfBirth.toISOString().slice(0, 10)).toBe("1995-04-12");
    expect(parsed).not.toHaveProperty("firstName");
  });

  it("rejects missing required fields and a password mismatch", () => {
    const missing = registrationSchema.safeParse({
      ...valid,
      fullName: "",
      phone: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
      acceptPrivacy: false,
      gender: "",
      dateOfBirth: "",
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      const fields = new Set(missing.error.issues.map((issue) => String(issue.path[0])));
      expect(fields.has("fullName")).toBe(true);
      expect(fields.has("phone")).toBe(true);
      expect(fields.has("email")).toBe(true);
      expect(fields.has("password")).toBe(true);
      expect(fields.has("gender")).toBe(true);
      expect(fields.has("dateOfBirth")).toBe(true);
      expect(fields.has("acceptTerms")).toBe(true);
    }

    const mismatch = registrationSchema.safeParse({ ...valid, confirmPassword: "CorrectHorse13" });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues.some((issue) => issue.path[0] === "confirmPassword")).toBe(true);
    }
  });

  it("requires nationality and address, and keeps confirmation out of the stored result", () => {
    const missing = registrationSchema.safeParse({
      ...valid,
      nationality: " ",
      residentialAddress: " ",
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      const fields = new Set(missing.error.issues.map((issue) => String(issue.path[0])));
      expect(fields.has("nationality")).toBe(true);
      expect(fields.has("residentialAddress")).toBe(true);
    }

    const parsed = registrationSchema.parse({
      ...valid,
      nationality: "Canada",
      phone: "+14155552671",
      residentialAddress: "18 King Street",
    });
    expect(parsed.nationality).toBe("Canada");
    expect(parsed.phoneE164).toBe("+14155552671");
    expect(parsed.residentialAddress).toBe("18 King Street");
    expect(parsed).not.toHaveProperty("confirmPassword");
  });

  it("composes a calling code with a local number and scores the real password rules", () => {
    expect(composeInternationalPhone("SL", "076 000 001")).toBe("+23276000001");
    expect(passwordRequirementResults("CorrectHorse12").every((item) => item.met)).toBe(true);
    expect(passwordRequirementResults("Abc123").every((item) => item.met)).toBe(true);
    expect(passwordRequirementResults("Abc12").some((item) => !item.met)).toBe(true);
    expect(passwordRequirementResults("short").some((item) => !item.met)).toBe(true);

    const formData = new FormData();
    formData.set("phoneCountry", "SL");
    formData.set("phoneNational", "076000001");
    formData.set("fullName", valid.fullName);
    formData.set("gender", valid.gender);
    formData.set("dateOfBirth", valid.dateOfBirth);
    formData.set("nationality", "Sierra Leone");
    formData.set("email", valid.email);
    formData.set("residentialAddress", valid.residentialAddress);
    formData.set("password", valid.password);
    formData.set("confirmPassword", valid.confirmPassword);
    formData.set("acceptTerms", "on");
    formData.set("acceptPrivacy", "on");
    const input = formDataToRegistration(formData);
    expect(input.phone).toBe("+23276000001");
    expect(registrationSchema.parse(input).phoneE164).toBe("+23276000001");
  });
});
