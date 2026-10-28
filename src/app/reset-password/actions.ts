"use server";

import { completePasswordReset } from "@/lib/auth/password-reset";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";

export type ResetPasswordState = {
  formMessage?: string;
  done?: boolean;
};

export async function resetPassword(_previous: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password) {
    return { formMessage: "Enter a new password." };
  }
  if (password !== confirmPassword) {
    return { formMessage: "Passwords do not match." };
  }

  try {
    const result = await completePasswordReset(
      prisma,
      { token, password, now: new Date() },
      hashPassword,
    );
    if (!result.ok) {
      return { formMessage: result.formMessage };
    }
    return { done: true, formMessage: "Your password was updated. Sign in with the new password." };
  } catch {
    return { formMessage: "We could not update the password. Try again." };
  }
}
