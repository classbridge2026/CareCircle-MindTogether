"use server";

import { revalidatePath } from "next/cache";
import { DOCTOR_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { bookingMessage, scheduleAssignedFollowUp } from "@/lib/appointments/booking";
import { atMinutes, parseCalendarDate, parseClock } from "@/lib/appointments/time";
import { blockIfUnapproved } from "@/lib/doctor/session";
import { prisma } from "@/lib/db/prisma";

export type FollowUpState = { message?: string; tone?: "ok" | "error" };

export async function scheduleFollowUpAction(_previous: FollowUpState, formData: FormData): Promise<FollowUpState> {
  const user = await requireStoredRoles([DOCTOR_ROLE_CODE]);
  const blocked = await blockIfUnapproved(user.id);
  if (blocked) return { message: blocked, tone: "error" };
  const day = parseCalendarDate(String(formData.get("date") ?? ""));
  const minute = parseClock(String(formData.get("time") ?? ""));
  if (!day || minute === null) return { message: "Enter a future date and time. Times use Africa/Freetown (GMT).", tone: "error" };
  const locationId = String(formData.get("locationId") ?? "").trim();
  const result = await scheduleAssignedFollowUp(
    {
      actorUserId: user.id,
      sourceAppointmentId: String(formData.get("sourceAppointmentId") ?? ""),
      offeringId: String(formData.get("offeringId") ?? ""),
      locationId: locationId || null,
      startsAt: atMinutes(day, minute),
    },
    { db: prisma },
  );
  if (!result.ok) return { message: bookingMessage(result.code), tone: "error" };
  revalidatePath("/doctor/follow-ups");
  revalidatePath("/doctor/appointments");
  revalidatePath("/doctor");
  return { message: "The follow-up is confirmed. The patient does not need to pay to keep this time.", tone: "ok" };
}
