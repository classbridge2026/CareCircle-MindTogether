import { z } from "zod";
import { displayEmail, normalizeEmail } from "@/lib/auth/email-address";
import { normalizePhone } from "@/lib/auth/phone";

const PERSON_NAME = /^[\p{L}][\p{L}' .-]{1,119}$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const QUALIFICATION_KINDS = [
  "MEDICAL_DEGREE",
  "PROFESSIONAL_DIPLOMA",
  "SPECIALIST_QUALIFICATION",
  "BOARD_CERTIFICATION",
  "OTHER",
] as const;

export const QUALIFICATION_LABELS: Record<(typeof QUALIFICATION_KINDS)[number], string> = {
  MEDICAL_DEGREE: "Medical degree",
  PROFESSIONAL_DIPLOMA: "Professional diploma",
  SPECIALIST_QUALIFICATION: "Specialist qualification",
  BOARD_CERTIFICATION: "Board certification",
  OTHER: "Other professional qualification",
};

export const CREDENTIAL_TYPES = [
  "LICENSE",
  "DEGREE",
  "SPECIALTY_CERTIFICATE",
  "IDENTITY_DOCUMENT",
  "OTHER",
] as const;

export type DoctorField =
  | "fullName"
  | "email"
  | "phone"
  | "specialtyId"
  | "biography"
  | "qualificationTitle"
  | "yearsExperience"
  | "displayName"
  | "primarySpecialtyId"
  | "qualificationKind"
  | "qualificationInstitution"
  | "qualificationYear"
  | "licenseNumber"
  | "licenseAuthority"
  | "licenseExpiresOn"
  | "languages"
  | "consultationModes";

export function fieldErrorsFromZod(error: z.ZodError): Partial<Record<DoctorField, string>> {
  const fieldErrors: Partial<Record<DoctorField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key as DoctorField] = issue.message;
    }
  }
  return fieldErrors;
}

function readYear(value: string): { year: number | null; message?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { year: null };
  }
  if (!/^\d{4}$/.test(trimmed)) {
    return { year: null, message: "Enter a four-digit year." };
  }
  const year = Number(trimmed);
  const max = new Date().getUTCFullYear() + 1;
  if (year < 1940 || year > max) {
    return { year: null, message: `Enter a year from 1940 to ${max}.` };
  }
  return { year };
}

function readExperience(value: string): { years: number | null; message?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { years: null };
  }
  if (!/^\d{1,2}$/.test(trimmed)) {
    return { years: null, message: "Enter years of experience as a number." };
  }
  const years = Number(trimmed);
  if (years > 80) {
    return { years: null, message: "Enter 80 years of experience or fewer." };
  }
  return { years };
}

export function normalizeLicenseNumber(value: string): string | null {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9/-]/g, "");
  return normalized || null;
}

export function parseLanguages(value: string): string[] {
  const seen = new Set<string>();
  const languages: string[] = [];
  for (const part of value.split(",")) {
    const language = part.trim().replace(/\s+/g, " ");
    if (!language || language.length > 40 || seen.has(language.toLowerCase())) {
      continue;
    }
    seen.add(language.toLowerCase());
    languages.push(language);
    if (languages.length === 12) {
      break;
    }
  }
  return languages;
}

export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

export const addDoctorSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter the doctor's full name.")
      .max(120, "Use 120 characters or fewer.")
      .regex(PERSON_NAME, "Enter a full name using letters."),
    email: z.string().trim().min(1, "Enter an email address."),
    phone: z.string().trim().min(1, "Enter a phone number."),
    specialtyId: z.string().trim().regex(UUID_PATTERN, "Choose a specialty."),
    biography: z.string().trim().max(4000, "Use 4000 characters or fewer.").optional().default(""),
    qualificationTitle: z.string().trim().max(160, "Use 160 characters or fewer.").optional().default(""),
    yearsExperience: z.string().optional().default(""),
  })
  .superRefine((value, context) => {
    if (!normalizeEmail(value.email)) {
      context.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email address." });
    }
    if (!normalizePhone(value.phone)) {
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Enter a valid phone number, including the country code.",
      });
    }
    const experience = readExperience(value.yearsExperience);
    if (experience.message) {
      context.addIssue({ code: "custom", path: ["yearsExperience"], message: experience.message });
    }
  })
  .transform((value) => {
    const email = displayEmail(value.email);
    const emailNormalized = normalizeEmail(value.email);
    const phoneE164 = normalizePhone(value.phone);
    const years = readExperience(value.yearsExperience).years;
    if (!email || !emailNormalized || !phoneE164) {
      throw new Error("Doctor values failed normalization.");
    }
    return {
      fullName: value.fullName,
      email,
      emailNormalized,
      phoneE164,
      specialtyId: value.specialtyId,
      biography: value.biography.trim() || null,
      qualificationTitle: value.qualificationTitle.trim() || null,
      yearsExperience: years,
    };
  });

export function formDataToAddDoctor(formData: FormData) {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    specialtyId: String(formData.get("specialtyId") ?? ""),
    biography: String(formData.get("biography") ?? ""),
    qualificationTitle: String(formData.get("qualificationTitle") ?? ""),
    yearsExperience: String(formData.get("yearsExperience") ?? ""),
  };
}

const profileShape = z.object({
  fullName: z.string().trim().max(120),
  displayName: z.string().trim().max(120),
  phone: z.string().trim().max(30),
  biography: z.string().trim().max(4000),
  primarySpecialtyId: z.string().trim(),
  additionalSpecialtyIds: z.array(z.string()),
  qualificationKind: z.string().trim(),
  qualificationTitle: z.string().trim().max(160),
  qualificationInstitution: z.string().trim().max(160),
  qualificationYear: z.string(),
  licenseNumber: z.string().trim().max(80),
  licenseAuthority: z.string().trim().max(160),
  licenseExpiresOn: z.string().trim(),
  yearsExperience: z.string(),
  languages: z.string().trim().max(400),
  consultationOnline: z.boolean(),
  consultationInPerson: z.boolean(),
});

export type DoctorProfileDraft = {
  fullName: string;
  displayName: string;
  phoneE164: string | null;
  biography: string | null;
  primarySpecialtyId: string | null;
  additionalSpecialtyIds: string[];
  qualificationKind: (typeof QUALIFICATION_KINDS)[number] | null;
  qualificationTitle: string | null;
  qualificationInstitution: string | null;
  qualificationYear: number | null;
  licenseNumber: string | null;
  licenseAuthority: string | null;
  licenseExpiresOn: Date | null;
  yearsExperience: number | null;
  languages: string[];
  consultationModes: Array<"ONLINE" | "IN_PERSON">;
};

export function parseDoctorProfile(
  input: unknown,
  mode: "draft" | "submit",
): { ok: true; data: DoctorProfileDraft } | { ok: false; fieldErrors: Partial<Record<DoctorField, string>>; formMessage?: string } {
  const parsed = profileShape.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const fieldErrors: Partial<Record<DoctorField, string>> = {};

  if (value.fullName && !PERSON_NAME.test(value.fullName)) {
    fieldErrors.fullName = "Enter a full name using letters.";
  }
  if (value.displayName && !PERSON_NAME.test(value.displayName)) {
    fieldErrors.displayName = "Enter a display name using letters.";
  }
  if ((mode === "submit" || value.fullName.length > 0) && value.fullName.length < 2 && !fieldErrors.fullName) {
    if (mode === "submit" || value.fullName.length > 0) {
      fieldErrors.fullName = "Enter the doctor's full name.";
    }
  }
  if (mode === "submit" && value.displayName.length < 2 && !fieldErrors.displayName) {
    fieldErrors.displayName = "Enter a professional display name.";
  }

  let phoneE164: string | null = null;
  if (value.phone) {
    phoneE164 = normalizePhone(value.phone);
    if (!phoneE164) {
      fieldErrors.phone = "Enter a valid phone number, including the country code.";
    }
  } else if (mode === "submit") {
    fieldErrors.phone = "Enter a phone number.";
  }

  const specialtyIds = [value.primarySpecialtyId, ...value.additionalSpecialtyIds].filter(Boolean);
  if (value.primarySpecialtyId && !UUID_PATTERN.test(value.primarySpecialtyId)) {
    fieldErrors.primarySpecialtyId = "Choose a primary specialty.";
  }
  if (mode === "submit" && !value.primarySpecialtyId) {
    fieldErrors.primarySpecialtyId = "Choose a primary specialty.";
  }
  if (specialtyIds.some((id) => !UUID_PATTERN.test(id))) {
    fieldErrors.primarySpecialtyId = "Choose a specialty from the list.";
  }

  let qualificationKind: DoctorProfileDraft["qualificationKind"] = null;
  if (value.qualificationKind) {
    if (!QUALIFICATION_KINDS.includes(value.qualificationKind as (typeof QUALIFICATION_KINDS)[number])) {
      fieldErrors.qualificationKind = "Choose a qualification type.";
    } else {
      qualificationKind = value.qualificationKind as (typeof QUALIFICATION_KINDS)[number];
    }
  } else if (mode === "submit") {
    fieldErrors.qualificationKind = "Choose a qualification type.";
  }

  if (mode === "submit") {
    if (value.biography.trim().length < 40) fieldErrors.biography = "Enter a professional biography of at least 40 characters.";
    if (!value.qualificationTitle) fieldErrors.qualificationTitle = "Enter the qualification.";
    if (!value.qualificationInstitution) {
      fieldErrors.qualificationInstitution = "Enter the institution that awarded the qualification.";
    }
    if (!value.licenseNumber) fieldErrors.licenseNumber = "Enter the professional registration or licence number.";
    if (!value.licenseAuthority) fieldErrors.licenseAuthority = "Enter the licensing or registration authority.";
    if (!value.languages) fieldErrors.languages = "Enter at least one language.";
    if (!value.consultationOnline && !value.consultationInPerson) {
      fieldErrors.consultationModes = "Choose at least one consultation preference.";
    }
  }

  const yearResult = readYear(value.qualificationYear);
  const qualificationYear = yearResult.year;
  if (yearResult.message) {
    fieldErrors.qualificationYear = yearResult.message;
  } else if (mode === "submit" && qualificationYear === null) {
    fieldErrors.qualificationYear = "Enter the qualification year.";
  }

  const experienceResult = readExperience(value.yearsExperience);
  const yearsExperience = experienceResult.years;
  if (experienceResult.message) {
    fieldErrors.yearsExperience = experienceResult.message;
  } else if (mode === "submit" && yearsExperience === null) {
    fieldErrors.yearsExperience = "Enter years of experience.";
  }

  let licenseExpiresOn: Date | null = null;
  if (value.licenseExpiresOn) {
    licenseExpiresOn = parseIsoDate(value.licenseExpiresOn);
    if (!licenseExpiresOn) {
      fieldErrors.licenseExpiresOn = "Enter a valid expiry date.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const additional = [...new Set(value.additionalSpecialtyIds.filter((id) => id && id !== value.primarySpecialtyId))];
  const modes: Array<"ONLINE" | "IN_PERSON"> = [];
  if (value.consultationOnline) modes.push("ONLINE");
  if (value.consultationInPerson) modes.push("IN_PERSON");

  return {
    ok: true,
    data: {
      fullName: value.fullName,
      displayName: value.displayName || value.fullName,
      phoneE164,
      biography: value.biography || null,
      primarySpecialtyId: value.primarySpecialtyId || null,
      additionalSpecialtyIds: additional,
      qualificationKind,
      qualificationTitle: value.qualificationTitle || null,
      qualificationInstitution: value.qualificationInstitution || null,
      qualificationYear,
      licenseNumber: normalizeLicenseNumber(value.licenseNumber),
      licenseAuthority: value.licenseAuthority || null,
      licenseExpiresOn,
      yearsExperience,
      languages: parseLanguages(value.languages),
      consultationModes: modes,
    },
  };
}

function consultationPreferenceFromForm(formData: FormData): { consultationOnline: boolean; consultationInPerson: boolean } {
  const preference = String(formData.get("consultationPreference") ?? "").trim().toUpperCase();
  if (preference === "ONLINE") return { consultationOnline: true, consultationInPerson: false };
  if (preference === "IN_PERSON") return { consultationOnline: false, consultationInPerson: true };
  if (preference === "BOTH") return { consultationOnline: true, consultationInPerson: true };
  return {
    consultationOnline: formData.get("consultationOnline") === "on",
    consultationInPerson: formData.get("consultationInPerson") === "on",
  };
}

export function formDataToDoctorProfile(formData: FormData) {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    biography: String(formData.get("biography") ?? ""),
    primarySpecialtyId: String(formData.get("primarySpecialtyId") ?? ""),
    additionalSpecialtyIds: formData.getAll("additionalSpecialtyIds").map(String),
    qualificationKind: String(formData.get("qualificationKind") ?? ""),
    qualificationTitle: String(formData.get("qualificationTitle") ?? ""),
    qualificationInstitution: String(formData.get("qualificationInstitution") ?? ""),
    qualificationYear: String(formData.get("qualificationYear") ?? ""),
    licenseNumber: String(formData.get("licenseNumber") ?? ""),
    licenseAuthority: String(formData.get("licenseAuthority") ?? ""),
    licenseExpiresOn: String(formData.get("licenseExpiresOn") ?? ""),
    yearsExperience: String(formData.get("yearsExperience") ?? ""),
    languages: String(formData.get("languages") ?? ""),
    ...consultationPreferenceFromForm(formData),
  };
}
