"use server";

import { revalidatePath } from "next/cache";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { beginVisitPayment, refreshVisitPayment } from "@/lib/payments/collect";
import { reportAfrimoneyTransfer } from "@/lib/payments/afrimoney-transfer";
import { reportOrangeTransfer } from "@/lib/payments/orange-transfer";

export type PayState = { message?: string; tone?: "ok" | "error"; paymentUrl?: string };

export async function startWalletPaymentAction(_previous: PayState, formData: FormData): Promise<PayState> {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const result = await beginVisitPayment(
    {
      actorUserId: user.id,
      appointmentId,
      provider: String(formData.get("provider") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    },
    prisma,
  );
  revalidatePath(`/patient/appointments/${appointmentId}`);
  revalidatePath("/patient/payments");
  revalidatePath("/admin/payments");
  const started = Boolean(result.paymentUrl) || (result.message ?? "").startsWith("Afrimoney sent a prompt");
  return { message: result.message, paymentUrl: result.paymentUrl, tone: started ? "ok" : "error" };
}

export async function refreshWalletPaymentAction(_previous: PayState, formData: FormData): Promise<PayState> {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const result = await refreshVisitPayment({ actorUserId: user.id, appointmentId }, prisma);
  revalidatePath(`/patient/appointments/${appointmentId}`);
  revalidatePath("/patient/payments");
  revalidatePath("/admin/payments");
  const paid = result.message === "The payment is recorded.";
  return { message: result.message, tone: paid ? "ok" : "error" };
}

export async function reportOrangeTransferAction(_previous: PayState, formData: FormData): Promise<PayState> {
  const user = await requireStoredRoles([PATIENT_ROLE_CODE]);
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const reported = { actorUserId: user.id, appointmentId, reference: String(formData.get("reference") ?? "") };
  const result = String(formData.get("provider") ?? "") === "AFRIMONEY"
    ? await reportAfrimoneyTransfer(reported, prisma)
    : await reportOrangeTransfer(reported, prisma);
  revalidatePath(`/patient/appointments/${appointmentId}`);
  revalidatePath("/patient/payments");
  revalidatePath("/admin/payments");
  return result;
}
