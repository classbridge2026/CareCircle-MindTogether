import type { PrismaClient } from "@prisma/client";
import { closeUserAccount } from "@/lib/admin/user-accounts";
import { isUuid, sanitizeMetadata } from "@/lib/admin/rules";
import { normalizePhone } from "@/lib/auth/phone";
import { isUniqueConflict, isSchemaMismatch } from "./errors";
import { isAdministrator } from "./rules";

type Actor = { userId: string; roleCodes: string[] };
type Result = { ok: true; message: string } | { ok: false; message: string };

const NAME = /^[\p{L}][\p{L}' .-]{1,119}$/u;

function nameProblem(value: string): string | null {
  const name = value.trim();
  if (!NAME.test(name)) return "Enter a name using letters, spaces, apostrophes, or hyphens.";
  return null;
}

function experienceProblem(value: string): { years: number | null; message: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { years: null, message: null };
  if (!/^\d{1,2}$/.test(trimmed) || Number(trimmed) > 80) {
    return { years: null, message: "Enter years of experience as a number from 0 to 80." };
  }
  return { years: Number(trimmed), message: null };
}

function failure(error: unknown, fallback: string): Result {
  if (isUniqueConflict(error)) return { ok: false, message: "That phone number is already in use." };
  if (isSchemaMismatch(error)) return { ok: false, message: "This action is not available until the latest database migration has been applied." };
  return { ok: false, message: fallback };
}

export async function updateDoctorRecord(
  input: {
    doctorId: string;
    fullName: string;
    displayName: string;
    phone: string;
    qualificationTitle: string;
    yearsExperience: string;
    biography: string;
  },
  deps: { db: PrismaClient; actor: Actor },
): Promise<Result> {
  if (!isAdministrator(deps.actor.roleCodes)) return { ok: false, message: "Only an administrator can update a doctor." };
  if (!isUuid(input.doctorId)) return { ok: false, message: "That doctor was not found." };
  const fullNameError = nameProblem(input.fullName);
  if (fullNameError) return { ok: false, message: fullNameError };
  const displaySource = input.displayName.trim() || input.fullName.trim();
  const displayError = nameProblem(displaySource);
  if (displayError) return { ok: false, message: "Enter a display name using letters, spaces, apostrophes, or hyphens." };
  const qualificationTitle = input.qualificationTitle.trim();
  if (qualificationTitle.length > 160) return { ok: false, message: "Use 160 characters or fewer for the qualification." };
  const biography = input.biography.trim();
  if (biography.length > 4000) return { ok: false, message: "Use 4000 characters or fewer for the biography." };
  const experience = experienceProblem(input.yearsExperience);
  if (experience.message) return { ok: false, message: experience.message };
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, message: "Enter a valid phone number, including the country code." };

  try {
    const doctor = await deps.db.doctorProfile.findUnique({
      where: { id: input.doctorId },
      select: { id: true, userId: true, user: { select: { id: true, deletedAt: true, phoneE164: true, roles: { select: { role: { select: { code: true } } } } } } },
    });
    if (!doctor || doctor.user.deletedAt) return { ok: false, message: "That doctor was not found." };
    if (doctor.userId === deps.actor.userId) return { ok: false, message: "You cannot change your own doctor profile from this list." };
    if (phone !== doctor.user.phoneE164) {
      const owner = await deps.db.user.findFirst({ where: { phoneE164: phone, id: { not: doctor.userId } }, select: { id: true } });
      if (owner) return { ok: false, message: "That phone number is already in use." };
    }
    await deps.db.$transaction([
      deps.db.user.update({ where: { id: doctor.userId }, data: { phoneE164: phone } }),
      deps.db.doctorProfile.update({
        where: { id: doctor.id },
        data: {
          fullName: input.fullName.trim(),
          displayName: displaySource,
          qualificationTitle: qualificationTitle || null,
          yearsExperience: experience.years,
          biography: biography || null,
        },
      }),
      deps.db.auditLog.create({
        data: {
          actorUserId: deps.actor.userId,
          action: "doctor.updated",
          entityType: "DoctorProfile",
          entityId: doctor.id,
          metadata: sanitizeMetadata({ fullName: input.fullName.trim() }) ?? undefined,
        },
      }),
    ]);
    return { ok: true, message: "Doctor updated." };
  } catch (error) {
    return failure(error, "The doctor could not be updated.");
  }
}

export async function closeDoctorRecord(input: { doctorId: string }, deps: { db: PrismaClient; actor: Actor }): Promise<Result> {
  if (!isAdministrator(deps.actor.roleCodes)) return { ok: false, message: "Only an administrator can delete a doctor." };
  if (!isUuid(input.doctorId)) return { ok: false, message: "That doctor was not found." };
  try {
    const doctor = await deps.db.doctorProfile.findUnique({
      where: { id: input.doctorId },
      select: { id: true, fullName: true, userId: true, user: { select: { deletedAt: true } } },
    });
    if (!doctor || doctor.user.deletedAt) return { ok: false, message: "That doctor was not found." };
    const closed = await closeUserAccount({ userId: doctor.userId }, deps);
    if (!closed.ok) return closed;
    await deps.db.auditLog.create({
      data: {
        actorUserId: deps.actor.userId,
        action: "doctor.closed",
        entityType: "DoctorProfile",
        entityId: doctor.id,
        metadata: sanitizeMetadata({ fullName: doctor.fullName }) ?? undefined,
      },
    });
    return { ok: true, message: `Deleted ${doctor.fullName}. Appointments and verification history stay available.` };
  } catch (error) {
    return failure(error, "The doctor could not be deleted.");
  }
}
