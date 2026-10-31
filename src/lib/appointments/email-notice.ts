import type { PrismaClient } from "@prisma/client";
import { sendCareCircleEmail, type DeliveryResult } from "@/lib/auth/delivery";
import { nextRetryAt, reminderChannelAllowed, saveChannelNotice } from "@/lib/notifications/delivery";
import { loadSystemName } from "@/lib/brand/system-name";
import { ensureConsultationNotice } from "@/lib/consultations/notices";
import { formatBookingWhen } from "./time";

export type AppointmentNotice = "held" | "confirmed" | "cancelled" | "rescheduled" | "requested" | "reminder_day" | "reminder_hour";

const copy: Record<AppointmentNotice, { subject: (systemName: string) => string; line: string; type: string }> = {
  held: {
    subject: (systemName) => `Appointment hold on ${systemName}`,
    line: "An appointment hold is waiting for payment.",
    type: "appointment.held",
  },
  confirmed: {
    subject: (systemName) => `Appointment confirmed on ${systemName}`,
    line: "An appointment is confirmed.",
    type: "appointment.confirmed",
  },
  cancelled: {
    subject: (systemName) => `Appointment cancelled on ${systemName}`,
    line: "An appointment was cancelled.",
    type: "appointment.cancelled",
  },
  rescheduled: {
    subject: (systemName) => `Appointment rescheduled on ${systemName}`,
    line: "An appointment was moved to a new time. No payment is required.",
    type: "appointment.rescheduled",
  },
  requested: {
    subject: (systemName) => `Booking waiting for approval on ${systemName}`,
    line: "A booking is waiting for the doctor to approve it. The patient can see it under Pending.",
    type: "appointment.requested",
  },
  reminder_day: {
    subject: (systemName) => `Appointment tomorrow on ${systemName}`,
    line: "An appointment is scheduled for tomorrow.",
    type: "appointment.reminder.day",
  },
  reminder_hour: {
    subject: (systemName) => `Appointment in about an hour on ${systemName}`,
    line: "An appointment starts in about an hour.",
    type: "appointment.reminder.hour",
  },
};

const REMINDER: ReadonlySet<AppointmentNotice> = new Set(["reminder_day", "reminder_hour"]);

type PartyUser = { email: string; status: string; deletedAt: Date | null } | null | undefined;

type Recipient = { userId: string; email: string; href: string };

function partyReady(user: PartyUser) {
  return Boolean(user && !user.deletedAt && user.status !== "DISABLED" && user.email.trim());
}

export async function notifyAppointmentParties(
  db: PrismaClient,
  input: { appointmentId: string; event: AppointmentNotice; appBaseUrl?: string | null },
  deliver: (message: { to: string; subject: string; text: string; systemName?: string }) => Promise<DeliveryResult> = sendCareCircleEmail,
) {
  try {
    const appointment = await db.appointment.findUnique({
      where: { id: input.appointmentId },
      select: {
        id: true,
        mode: true,
        status: true,
        startsAt: true,
        patient: { select: { userId: true, user: { select: { email: true, status: true, deletedAt: true } } } },
        doctor: { select: { userId: true, user: { select: { email: true, status: true, deletedAt: true } } } },
      },
    });
    if (!appointment?.patient?.user || !appointment.doctor?.user) return;
    if (REMINDER.has(input.event) && appointment.status !== "CONFIRMED" && appointment.status !== "CHECKED_IN") return;

    const base = (input.appBaseUrl ?? process.env.APP_BASE_URL)?.trim().replace(/\/$/, "") ?? "";
    const when = formatBookingWhen(appointment.startsAt);
    const systemName = await loadSystemName(db);
    const notice = copy[input.event];
    const subject = notice.subject(systemName);
    const recipients: Recipient[] = [];
    if (partyReady(appointment.patient.user)) {
      recipients.push({
        userId: appointment.patient.userId,
        email: appointment.patient.user.email,
        href: base ? `${base}/patient/appointments/${appointment.id}` : "",
      });
    }
    if (partyReady(appointment.doctor.user) && appointment.doctor.userId !== appointment.patient.userId) {
      recipients.push({
        userId: appointment.doctor.userId,
        email: appointment.doctor.user.email,
        href: base ? `${base}/doctor/appointments/${appointment.id}` : "",
      });
    }

    for (const recipient of recipients) {
      if (REMINDER.has(input.event)) {
        const already = await db.notification.findFirst({
          where: {
            recipientId: recipient.userId,
            channel: "IN_APP",
            type: notice.type,
            entityType: "Appointment",
            entityId: appointment.id,
          },
          select: { id: true },
        });
        if (already) continue;
      }
      const text = [notice.line, `Time: ${when} (Africa/Freetown).`, recipient.href ? `Open the appointment: ${recipient.href}` : ""]
        .filter(Boolean)
        .join("\n");
      const preview = `${notice.line} ${when}.`;
      const baseNotice = {
        recipientId: recipient.userId,
        type: notice.type,
        title: subject,
        preview,
        entityType: "Appointment",
        entityId: appointment.id,
      };
      await saveChannelNotice(db, { ...baseNotice, channel: "IN_APP", status: "SENT" });
      const emailAllowed = !REMINDER.has(input.event) || (await reminderChannelAllowed(db, recipient.userId, "EMAIL"));
      if (!emailAllowed) {
        await saveChannelNotice(db, { ...baseNotice, channel: "EMAIL", status: "SUPPRESSED", errorCode: "suppressed", preview: "An appointment email was not sent." });
      } else {
        let result: DeliveryResult = { delivered: false, reason: "not_configured" };
        try {
          result = await deliver({ to: recipient.email, subject, text, systemName });
        } catch {
          result = { delivered: false, reason: "provider_failed" };
        }
        await saveChannelNotice(db, {
          ...baseNotice,
          channel: "EMAIL",
          status: result.delivered ? "SENT" : "FAILED",
          errorCode: result.delivered ? null : result.reason,
          nextRetryAt: nextRetryAt(1, new Date(), result.delivered ? null : result.reason),
          preview: result.delivered ? "An appointment email was sent." : "An appointment email could not be sent.",
        });
      }
    }
    if (input.event === "confirmed" && appointment.mode === "ONLINE") {
      for (const recipient of recipients) {
        await ensureConsultationNotice(db, {
          recipientId: recipient.userId,
          appointmentId: appointment.id,
          type: "consultation.preparation",
        });
      }
    }
  } catch {
    console.error("appointment_email_failed");
  }
}
