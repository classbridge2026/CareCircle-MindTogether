"use server";

import { revalidatePath } from "next/cache";
import { sendCareCircleEmail } from "@/lib/auth/delivery";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { hashPassword } from "@/lib/auth/password";
import { appBaseUrlFromEnv } from "@/lib/auth/register-patient";
import { requestContext } from "@/lib/auth/request-context";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { createDoctorAccount, type CreateDoctorResult } from "@/lib/doctors/create-doctor";
import { formDataToAddDoctor } from "@/lib/validation/doctor";

export type AddDoctorState = CreateDoctorResult;

export async function addDoctorAction(_previous: AddDoctorState, formData: FormData): Promise<CreateDoctorResult> {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const context = await requestContext();
  const result = await createDoctorAccount(formDataToAddDoctor(formData), {
    db: prisma,
    actor: { userId: user.id, roleCodes: user.roleCodes },
    hashPassword,
    deliver: sendCareCircleEmail,
    now: new Date(),
    appBaseUrl: appBaseUrlFromEnv(context.origin),
    logError: (code) => {
      console.error(code);
    },
  });
  if (result.ok) {
    revalidatePath("/admin/doctors");
    revalidatePath("/admin/doctors/all");
    revalidatePath("/admin/doctors/invitations");
  }
  return result;
}
