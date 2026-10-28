import { z } from "zod";
import { countryByIso } from "@/lib/data/countries";
import { displayEmail, normalizeEmail } from "@/lib/auth/email-address";
import { normalizePhone } from "@/lib/auth/phone";

export const GENDER_VALUES = ["MALE", "FEMALE"] as const;
export type GenderValue = (typeof GENDER_VALUES)[number];

export const GENDER_LABELS: Record<GenderValue, string> = {
  MALE: "Male",
  FEMALE: "Female",
};

const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date from a `YYYY-MM-DD` field. Rejects impossible days such as 2026-02-31. */
export function parseCalendarDate(value: string): Date | null {
  const raw = value.trim();
  if (!DOB_PATTERN.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return null;
  return date;
}

export function isPlausibleDateOfBirth(date: Date, now = new Date()): boolean {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const earliest = Date.UTC(now.getUTCFullYear() - 120, now.getUTCMonth(), now.getUTCDate());
  const value = date.getTime();
  return value <= today && value >= earliest;
}

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_HAS_LETTER = /[A-Za-z]/;
export const PASSWORD_HAS_NUMBER = /\d/;

const FULL_NAME = /^[\p{L}][\p{L}' .-]{1,119}$/u;
const NATIONALITY = /^[\p{L}][\p{L}'’ .-]{1,79}$/u;

export function passwordRequirementResults(password: string) {
  return [
    {
      id: "length",
      label: `${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters`,
      met: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    },
    {
      id: "letter",
      label: "At least one letter",
      met: PASSWORD_HAS_LETTER.test(password),
    },
    {
      id: "number",
      label: "At least one number",
      met: PASSWORD_HAS_NUMBER.test(password),
    },
  ];
}

/** Join a selected calling code with a local number. A full international value is left unchanged. */
export function composeInternationalPhone(countryIso: string, national: string): string {
  const trimmed = national.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    return trimmed;
  }
  const country = countryByIso(countryIso);
  if (!country) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) {
    return "";
  }
  return `${country.dial}${digits}`;
}

export const registrationSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter a full name.")
      .max(120, "Use 120 characters or fewer for the full name.")
      .regex(FULL_NAME, "Enter a full name using letters."),
    gender: z.enum(GENDER_VALUES, { message: "Select a gender." }),
    dateOfBirth: z.string().trim().min(1, "Enter a date of birth."),
    nationality: z
      .string()
      .trim()
      .min(2, "Select a nationality.")
      .max(80, "Use 80 characters or fewer for the nationality.")
      .regex(NATIONALITY, "Enter a nationality using letters."),
    phone: z.string().trim().min(1, "Enter a phone number."),
    email: z.string().trim().min(1, "Enter an email address."),
    residentialAddress: z
      .string()
      .trim()
      .min(5, "Enter an address.")
      .max(200, "Use 200 characters or fewer for the address."),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
      .max(PASSWORD_MAX_LENGTH, "Use a password of 128 characters or fewer.")
      .refine((value) => PASSWORD_HAS_LETTER.test(value) && PASSWORD_HAS_NUMBER.test(value), {
        message: "Use at least one letter and one number.",
      }),
    confirmPassword: z.string().min(1, "Confirm your password."),
    acceptTerms: z.literal(true, { message: "Accept the Terms of Service to create an account." }),
    acceptPrivacy: z.literal(true, { message: "Accept the Privacy Notice to create an account." }),
  })
  .superRefine((value, context) => {
    const dateOfBirth = parseCalendarDate(value.dateOfBirth);
    if (!dateOfBirth || !isPlausibleDateOfBirth(dateOfBirth)) {
      context.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Enter a valid date of birth.",
      });
    }

    if (!normalizePhone(value.phone)) {
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Enter a valid phone number, including the country code.",
      });
    }

    if (!normalizeEmail(value.email)) {
      context.addIssue({
        code: "custom",
        path: ["email"],
        message: "Enter a valid email address.",
      });
    }

    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  })
  .transform((value) => {
    const email = displayEmail(value.email);
    const emailNormalized = normalizeEmail(value.email);
    const phoneE164 = normalizePhone(value.phone);
    if (!email || !emailNormalized || !phoneE164) {
      throw new Error("Registration values failed normalization.");
    }
    return {
      fullName: value.fullName,
      gender: value.gender,
      dateOfBirth: parseCalendarDate(value.dateOfBirth) as Date,
      nationality: value.nationality,
      phoneE164,
      email,
      emailNormalized,
      residentialAddress: value.residentialAddress,
      password: value.password,
      acceptTerms: true as const,
      acceptPrivacy: true as const,
    };
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

export type RegistrationField = keyof z.input<typeof registrationSchema>;

export function fieldErrorsFromZod(error: z.ZodError): Partial<Record<RegistrationField, string>> {
  const fieldErrors: Partial<Record<RegistrationField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key as RegistrationField] = issue.message;
    }
  }
  return fieldErrors;
}

export function formDataToRegistration(formData: FormData) {
  const national = String(formData.get("phoneNational") ?? "");
  const countryIso = String(formData.get("phoneCountry") ?? "");
  const direct = String(formData.get("phone") ?? "");
  return {
    fullName: String(formData.get("fullName") ?? ""),
    gender: String(formData.get("gender") ?? ""),
    dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
    nationality: String(formData.get("nationality") ?? ""),
    phone: national.trim() ? composeInternationalPhone(countryIso, national) : direct.trim(),
    email: String(formData.get("email") ?? ""),
    residentialAddress: String(formData.get("residentialAddress") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    acceptTerms: formData.get("acceptTerms") === "on",
    acceptPrivacy: formData.get("acceptPrivacy") === "on",
  };
}
