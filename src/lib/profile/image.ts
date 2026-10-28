import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { ADMIN_ROLE_CODE, DOCTOR_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { parseUuid } from "@/lib/catalog/rules";
import { isRecordsOffline } from "@/lib/db/offline";

export const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;

const ALLOWED = [
  { mime: "image/jpeg", extensions: ["jpg", "jpeg"], magic: [0xff, 0xd8, 0xff] },
  { mime: "image/png", extensions: ["png"], magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", extensions: ["webp"], magic: [0x52, 0x49, 0x46, 0x46] },
] as const;

export type ProfileImageCheck =
  | { ok: true; mimeType: string; sizeBytes: number }
  | { ok: false; message: string };

function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const parts = base.toLowerCase().split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1] ?? "";
}

function magicMatches(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((value, index) => bytes[index] === value);
}

function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const webp = [0x57, 0x45, 0x42, 0x50];
  return webp.every((value, index) => bytes[index + 8] === value);
}

export function inspectProfileImage(input: { filename: string; declaredMime: string; bytes: Uint8Array }): ProfileImageCheck {
  if (input.bytes.byteLength === 0) {
    return { ok: false, message: "Choose a photo to upload." };
  }
  if (input.bytes.byteLength > MAX_PROFILE_IMAGE_BYTES) {
    return { ok: false, message: "Photos must be 2 MB or smaller." };
  }
  const extension = extensionOf(input.filename);
  const declared = input.declaredMime.trim().toLowerCase();
  const match = ALLOWED.find((entry) => entry.extensions.some((item) => item === extension) && entry.mime === declared && magicMatches(input.bytes, entry.magic));
  if (!match || (match.mime === "image/webp" && !isWebp(input.bytes))) {
    return { ok: false, message: "Upload a JPEG, PNG, or WebP photo. The file type and contents must match." };
  }
  return { ok: true, mimeType: match.mime, sizeBytes: input.bytes.byteLength };
}

export async function saveProfileImage(
  input: { actorUserId: string; filename: string; declaredMime: string; bytes: Uint8Array },
  deps: { db: PrismaClient; now: Date },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const inspected = inspectProfileImage(input);
  if (!inspected.ok) return inspected;
  try {
    const updated = await deps.db.user.updateMany({
      where: { id: input.actorUserId, deletedAt: null },
      data: {
        profileImageBytes: Buffer.from(input.bytes),
        profileImageType: inspected.mimeType,
        profileImageUpdatedAt: deps.now,
      },
    });
    if (updated.count !== 1) return { ok: false, message: "Your account is not available for a profile photo." };
    await deps.db.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "profile.image.updated",
        entityType: "User",
        entityId: input.actorUserId,
        metadata: {
          mimeType: inspected.mimeType,
          sizeBytes: inspected.sizeBytes,
          checksumSha256: createHash("sha256").update(input.bytes).digest("hex"),
        },
      },
    });
    return { ok: true, message: "Your profile photo is saved." };
  } catch {
    return { ok: false, message: "The photo could not be saved right now." };
  }
}

export async function removeProfileImage(
  actorUserId: string,
  deps: { db: PrismaClient },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  try {
    const user = await deps.db.user.findUnique({
      where: { id: actorUserId },
      select: { profileImageUpdatedAt: true, deletedAt: true },
    });
    if (!user || user.deletedAt) return { ok: false, message: "Your account is not available for a profile photo." };
    if (!user.profileImageUpdatedAt) return { ok: false, message: "No profile photo is saved." };
    await deps.db.user.update({
      where: { id: actorUserId },
      data: { profileImageBytes: null, profileImageType: null, profileImageUpdatedAt: null },
    });
    await deps.db.auditLog.create({
      data: {
        actorUserId,
        action: "profile.image.removed",
        entityType: "User",
        entityId: actorUserId,
      },
    });
    return { ok: true, message: "Your profile photo was removed." };
  } catch {
    return { ok: false, message: "The photo could not be removed right now." };
  }
}

export async function openProfileImage(
  userId: string,
  viewer: { id: string; roleCodes: string[] } | null,
  deps: { db: PrismaClient },
): Promise<{ ok: true; body: Uint8Array; mimeType: string } | { ok: false; status: 404 }> {
  if (!parseUuid(userId)) return { ok: false, status: 404 };
  try {
    const target = await deps.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        profileImageBytes: true,
        profileImageType: true,
        patientProfile: { select: { id: true } },
        doctorProfile: { select: { verificationStatus: true } },
      },
    });
    if (!target || target.deletedAt || !target.profileImageBytes || !target.profileImageType) {
      return { ok: false, status: 404 };
    }
    const allowed = await canViewProfileImage(viewer, target, deps.db);
    if (!allowed) return { ok: false, status: 404 };
    if (target.profileImageType !== "image/jpeg" && target.profileImageType !== "image/png" && target.profileImageType !== "image/webp") {
      return { ok: false, status: 404 };
    }
    return { ok: true, body: new Uint8Array(target.profileImageBytes), mimeType: target.profileImageType };
  } catch (error) {
    if (isRecordsOffline(error)) return { ok: false, status: 404 };
    throw error;
  }
}

async function canViewProfileImage(
  viewer: { id: string; roleCodes: string[] } | null,
  target: {
    id: string;
    status: string;
    patientProfile: { id: string } | null;
    doctorProfile: { verificationStatus: string } | null;
  },
  db: PrismaClient,
): Promise<boolean> {
  const publicDoctor = target.status === "ACTIVE" && target.doctorProfile?.verificationStatus === "APPROVED";
  if (publicDoctor) return true;
  if (!viewer) return false;
  if (viewer.id === target.id) return true;
  if (viewer.roleCodes.includes(ADMIN_ROLE_CODE) || viewer.roleCodes.includes(SUPER_ADMIN_ROLE_CODE)) return true;
  if (viewer.roleCodes.includes(DOCTOR_ROLE_CODE) && target.patientProfile) {
    const visit = await db.appointment.findFirst({
      where: { patient: { userId: target.id }, doctor: { userId: viewer.id } },
      select: { id: true },
    });
    return Boolean(visit);
  }
  return false;
}
