import type { Gender, PrismaClient } from "@prisma/client";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { isPlausibleDateOfBirth, parseCalendarDate } from "@/lib/validation/registration";
import { isPortalAdministrator, isUuid } from "./rules";
import { closeUserAccount, createUserAccount, updateUserAccount } from "./user-accounts";

type Actor = { userId: string; roleCodes: string[] };
type Result = { ok: true; message: string } | { ok: false; message: string };

const GENDERS = ["MALE", "FEMALE"] as const;

export async function createPatientAccount(
  input: { fullName: string; email: string; phone: string; password: string; gender: string; dateOfBirth: string },
  deps: { db: PrismaClient; actor: Actor },
): Promise<Result> {
  return createUserAccount({ ...input, roleCode: PATIENT_ROLE_CODE }, deps);
}

export async function updatePatientAccount(
  input: {
    userId: string;
    patientId: string;
    fullName: string;
    email: string;
    phone: string;
    timezone: string;
    status: string;
    password: string;
    gender: string;
    dateOfBirth: string;
    nationality: string;
    residentialAddress: string;
    preferredLanguage: string;
    emergencyContactName: string;
    isDependent: boolean;
  },
  deps: { db: PrismaClient; actor: Actor },
): Promise<Result> {
  if (!isUuid(input.patientId)) return { ok: false, message: "That patient profile was not found." };
  const gender = GENDERS.find((value) => value === input.gender);
  if (!gender) return { ok: false, message: "Choose Male or Female." };
  const dateOfBirth = parseCalendarDate(input.dateOfBirth);
  if (!dateOfBirth || !isPlausibleDateOfBirth(dateOfBirth)) return { ok: false, message: "Enter a valid date of birth." };
  const account = await updateUserAccount(
    {
      userId: input.userId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      timezone: input.timezone,
      status: input.status,
      password: input.password,
    },
    deps,
  );
  if (!account.ok) return account;
  try {
    const updated = await deps.db.patientProfile.updateMany({
      where: { id: input.patientId, userId: input.userId, archivedAt: null },
      data: {
        gender: gender as Gender,
        dateOfBirth,
        nationality: input.nationality.trim() || null,
        residentialAddress: input.residentialAddress.trim() || null,
        preferredLanguage: input.preferredLanguage.trim() || null,
        emergencyContactName: input.emergencyContactName.trim() || null,
        isDependent: input.isDependent,
      },
    });
    if (updated.count === 0) return { ok: false, message: "That patient profile was not found." };
    return { ok: true, message: account.message };
  } catch {
    return { ok: false, message: "The patient profile could not be updated." };
  }
}

export async function archivePatientAccount(
  input: { patientId: string },
  deps: { db: PrismaClient; actor: Actor },
): Promise<Result> {
  if (!isPortalAdministrator(deps.actor.roleCodes)) return { ok: false, message: "You cannot change this account." };
  if (!isUuid(input.patientId)) return { ok: false, message: "That patient profile was not found." };
  try {
    const patient = await deps.db.patientProfile.findUnique({
      where: { id: input.patientId },
      select: { id: true, userId: true, archivedAt: true, fullName: true, user: { select: { deletedAt: true } } },
    });
    if (!patient || patient.archivedAt) return { ok: false, message: "That patient profile was not found." };
    if (!patient.user.deletedAt) {
      const closed = await closeUserAccount({ userId: patient.userId }, deps);
      if (!closed.ok) {
        const login = await deps.db.user.findUnique({ where: { id: patient.userId }, select: { deletedAt: true } });
        if (!login?.deletedAt) return closed;
      }
    }
    await deps.db.patientProfile.update({
      where: { id: patient.id },
      data: { archivedAt: new Date() },
    });
    return { ok: true, message: `Deleted ${patient.fullName}. Appointments already stored stay available.` };
  } catch {
    return { ok: false, message: "The patient profile could not be deleted." };
  }
}
