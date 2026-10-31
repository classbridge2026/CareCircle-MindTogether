import type { PrismaClient } from "@prisma/client";
import { isRecordsOffline } from "@/lib/db/offline";
import { inspectProfileImage } from "@/lib/profile/image";

export const SUPPORT_CATEGORIES = [
  { code: "SIGN_IN", label: "Cannot sign in" },
  { code: "PASSWORD", label: "Forgot password" },
  { code: "LOCKED_OUT", label: "Account is locked" },
  { code: "CONTACT_CHANGE", label: "Change the email or phone on the account" },
  { code: "ACCOUNT_MISSING", label: "Account not found" },
  { code: "OTHER", label: "Another account problem" },
] as const;

export type SupportCategoryCode = (typeof SUPPORT_CATEGORIES)[number]["code"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 5;

export function supportCategoryLabel(code: string): string {
  return SUPPORT_CATEGORIES.find((item) => item.code === code)?.label ?? code;
}

export type SupportFields =
  | { ok: true; email: string; category: SupportCategoryCode; description: string }
  | { ok: false; message: string };

export function parseSupportFields(input: { email: string; category: string; description: string }): SupportFields {
  const email = input.email.trim().toLowerCase();
  if (!email || email.length > 120 || !EMAIL.test(email)) {
    return { ok: false, message: "Enter the email address for the account." };
  }
  const category = SUPPORT_CATEGORIES.find((item) => item.code === input.category.trim())?.code;
  if (!category) return { ok: false, message: "Choose the kind of account problem." };
  const description = input.description.trim();
  if (description.length < 10) return { ok: false, message: "Describe the problem in at least a short sentence." };
  if (description.length > 2000) return { ok: false, message: "The description must be 2000 characters or fewer." };
  return { ok: true, email, category, description };
}

export type SupportAttachment = { bytes: Uint8Array; mimeType: string; name: string };

function attachmentName(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const clean = base.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 80);
  return clean || "screenshot";
}

export async function readSupportAttachment(file: File | null | undefined): Promise<{ ok: true; attachment: SupportAttachment | null } | { ok: false; message: string }> {
  if (!file || file.size === 0) return { ok: true, attachment: null };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = inspectProfileImage({ filename: file.name || "screenshot", declaredMime: file.type, bytes });
  if (!checked.ok) return { ok: false, message: "The attachment must be a JPEG, PNG, or WebP screenshot up to 2 MB." };
  return { ok: true, attachment: { bytes, mimeType: checked.mimeType, name: attachmentName(file.name || "screenshot") } };
}

export async function submitSupportRequest(
  db: PrismaClient,
  fields: Extract<SupportFields, { ok: true }>,
  attachment: SupportAttachment | null,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  try {
    const since = new Date(Date.now() - HOUR_MS);
    const recent = await db.supportRequest.count({ where: { email: fields.email, createdAt: { gte: since } } });
    if (recent >= MAX_PER_HOUR) {
      return { ok: false, message: "This email already sent several requests in the last hour. Wait, then try again." };
    }
    const saved = await db.supportRequest.create({
      data: {
        email: fields.email,
        category: fields.category,
        description: fields.description,
        attachmentBytes: attachment ? Buffer.from(attachment.bytes) : null,
        attachmentMime: attachment?.mimeType ?? null,
        attachmentName: attachment?.name ?? null,
      },
      select: { id: true },
    });
    await db.auditLog.create({
      data: {
        actorType: "SYSTEM",
        action: "support.request_submitted",
        entityType: "SupportRequest",
        entityId: saved.id,
        metadata: { category: fields.category, hasAttachment: Boolean(attachment) },
      },
    });
    return { ok: true, message: "Your request was sent. An administrator can read it in Account support." };
  } catch (error) {
    if (isRecordsOffline(error)) return { ok: false, message: "The request could not be saved just now. Try again when the connection returns." };
    throw error;
  }
}

export async function reviewSupportRequest(db: PrismaClient, id: string, actorUserId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const current = await db.supportRequest.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!current) return { ok: false, message: "That request is not stored." };
    if (current.status === "REVIEWED") return { ok: true };
    await db.supportRequest.update({ where: { id }, data: { status: "REVIEWED", reviewedAt: new Date() } });
    await db.auditLog.create({
      data: {
        actorUserId,
        action: "support.request_reviewed",
        entityType: "SupportRequest",
        entityId: id,
      },
    });
    return { ok: true };
  } catch (error) {
    if (isRecordsOffline(error)) return { ok: false, message: "The request could not be updated just now." };
    throw error;
  }
}
