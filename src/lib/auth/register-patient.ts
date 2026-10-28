import { randomUUID } from "node:crypto";
import type { Gender, PrismaClient } from "@prisma/client";
import { ConsentType, UserStatus } from "@prisma/client";
import {
  GENERIC_DUPLICATE_ACCOUNT,
  PATIENT_ROLE_CODE,
  PRIVACY_DOCUMENT_VERSION,
  TERMS_DOCUMENT_VERSION,
} from "./constants";
import type { RateLimiter } from "./rate-limit";
import { sessionExpiry } from "./session";
import { createEmailToken, hashSessionToken } from "./tokens";
import { fieldErrorsFromZod, registrationSchema, type RegistrationField } from "@/lib/validation/registration";

export type PublicRegistrationResult =
  | {
      ok: true;
      message: string;
      sessionToken: string;
    }
  | {
      ok: false;
      formMessage?: string;
      fieldErrors?: Partial<Record<RegistrationField, string>>;
    };

export type RegistrationDeps = {
  db: PrismaClient;
  hashPassword: (password: string) => Promise<string>;
  rateLimiter: RateLimiter;
  ipHash: string;
  now: () => Date;
  appBaseUrl: string | null;
  logError?: (code: string) => void;
};

function isUniqueConstraint(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002",
  );
}

export function appBaseUrlFromEnv(requestOrigin?: string | null): string | null {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV !== "production" && requestOrigin) {
    return requestOrigin.replace(/\/$/, "");
  }
  return null;
}

export async function registerPatient(
  input: unknown,
  deps: RegistrationDeps,
): Promise<PublicRegistrationResult> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const rate = deps.rateLimiter.check(`register:${deps.ipHash}`);
  if (!rate.allowed) {
    return {
      ok: false,
      formMessage: "Too many registration attempts. Wait before trying again.",
    };
  }

  const data = parsed.data;

  let passwordHash: string;
  try {
    passwordHash = await deps.hashPassword(data.password);
  } catch {
    deps.logError?.("password_hash_failed");
    return { ok: false, formMessage: "We could not create the account. Try again." };
  }

  const now = deps.now();
  const userId = randomUUID();
  const sessionToken = createEmailToken().raw;

  try {
    const role = await deps.db.role.findUnique({ where: { code: PATIENT_ROLE_CODE } });
    if (!role) {
      return { ok: false, formMessage: "Patient registration is not available right now." };
    }

    // One nested write. The Neon pooler drops a multi-step interactive transaction.
    await deps.db.user.create({
      data: {
        id: userId,
        email: data.email,
        emailNormalized: data.emailNormalized,
        phoneE164: data.phoneE164,
        passwordHash,
        status: UserStatus.ACTIVE,
        roles: { create: { roleId: role.id } },
        patientProfile: {
          create: {
            fullName: data.fullName,
            gender: data.gender as Gender,
            dateOfBirth: data.dateOfBirth,
            nationality: data.nationality,
            residentialAddress: data.residentialAddress,
            isDependent: false,
          },
        },
        consents: {
          create: [
            {
              consentType: ConsentType.TERMS_OF_USE,
              documentVersion: TERMS_DOCUMENT_VERSION,
              acceptedAt: now,
            },
            {
              consentType: ConsentType.PRIVACY_NOTICE,
              documentVersion: PRIVACY_DOCUMENT_VERSION,
              acceptedAt: now,
            },
          ],
        },
        sessions: {
          create: {
            tokenHash: hashSessionToken(sessionToken),
            expiresAt: sessionExpiry(now),
            ipAddressHash: deps.ipHash,
          },
        },
        auditLogs: {
          create: {
            action: "patient.registered",
            entityType: "User",
            entityId: userId,
            metadata: {
              role: PATIENT_ROLE_CODE,
              termsVersion: TERMS_DOCUMENT_VERSION,
              privacyVersion: PRIVACY_DOCUMENT_VERSION,
            },
          },
        },
      },
    });

  } catch (error) {
    if (isUniqueConstraint(error)) {
      return { ok: false, formMessage: GENERIC_DUPLICATE_ACCOUNT };
    }
    deps.logError?.("registration_failed");
    return { ok: false, formMessage: "We could not create the account. Try again." };
  }

  return {
    ok: true,
    sessionToken,
    message: "Your patient portal is ready.",
  };
}
