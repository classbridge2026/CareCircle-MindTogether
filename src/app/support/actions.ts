"use server";

import { prisma } from "@/lib/db/prisma";
import { parseSupportFields, readSupportAttachment, submitSupportRequest } from "@/lib/support/request";

export type SupportFormState = { message?: string; tone?: "ok" | "error" };

export async function submitSupportRequestAction(_state: SupportFormState, formData: FormData): Promise<SupportFormState> {
  const fields = parseSupportFields({
    email: String(formData.get("email") ?? ""),
    category: String(formData.get("category") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  if (!fields.ok) return { tone: "error", message: fields.message };
  const file = formData.get("attachment");
  const attachment = await readSupportAttachment(file instanceof File ? file : null);
  if (!attachment.ok) return { tone: "error", message: attachment.message };
  const saved = await submitSupportRequest(prisma, fields, attachment.attachment);
  return saved.ok ? { tone: "ok", message: saved.message } : { tone: "error", message: saved.message };
}
