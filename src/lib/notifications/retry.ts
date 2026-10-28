import type { NotificationChannel, PrismaClient } from "@prisma/client";
import { isUuid } from "@/lib/admin/rules";
import { sendCareCircleEmail } from "@/lib/auth/delivery";
import { isSchemaMismatch } from "@/lib/doctors/errors";
import { MAX_DELIVERY_ATTEMPTS, nextRetryAt } from "./delivery";

const SECURITY_TYPES = ["auth.email_verification", "auth.password_reset"];

export async function retryDueNotices(db: PrismaClient, now = new Date()): Promise<number> {
  if (!("notification" in db) || !db.notification?.findMany) return 0;
  let rows: Array<{
    id: string;
    recipientId: string;
    channel: NotificationChannel;
    title: string;
    preview: string | null;
    attemptCount: number;
    recipient: { email: string; phoneE164: string | null; status: string; deletedAt: Date | null } | null;
  }> = [];
  try {
    rows = await db.notification.findMany({
      where: {
        channel: "EMAIL",
        status: "FAILED",
        errorCode: "provider_failed",
        attemptCount: { lt: MAX_DELIVERY_ATTEMPTS },
        nextRetryAt: { lte: now },
        type: { notIn: SECURITY_TYPES },
      },
      take: 20,
      select: {
        id: true,
        recipientId: true,
        channel: true,
        title: true,
        preview: true,
        attemptCount: true,
        recipient: { select: { email: true, phoneE164: true, status: true, deletedAt: true } },
      },
    });
  } catch (error) {
    if (isSchemaMismatch(error) || error instanceof TypeError) return 0;
    throw error;
  }

  let retried = 0;
  for (const row of rows) {
    if (row.channel !== "EMAIL") continue;
    const user = row.recipient;
    if (!user || user.deletedAt || user.status === "DISABLED") continue;
    const claimed = await db.notification.updateMany({
      where: { id: row.id, status: "FAILED", attemptCount: row.attemptCount },
      data: { status: "QUEUED", nextRetryAt: null },
    });
    if (claimed.count !== 1) continue;
    const attempt = row.attemptCount + 1;
    let delivered = false;
    let errorCode: string | null = "provider_failed";
    try {
      if (row.channel === "EMAIL") {
        const result = await sendCareCircleEmail({ to: user.email, subject: row.title, text: row.preview ?? row.title });
        delivered = result.delivered;
        errorCode = result.delivered ? null : result.reason;
      } else {
        errorCode = "invalid_destination";
      }
    } catch {
      console.error("notification_retry_failed");
      errorCode = "provider_failed";
    }
    await db.notification.update({
      where: { id: row.id },
      data: {
        status: delivered ? "SENT" : "FAILED",
        attemptCount: attempt,
        errorCode,
        nextRetryAt: delivered ? null : nextRetryAt(attempt, now, errorCode),
      },
    });
    if ("notificationAttempt" in db && db.notificationAttempt) {
      try {
        await db.notificationAttempt.create({
          data: {
            notificationId: row.id,
            attemptNumber: attempt,
            status: delivered ? "SENT" : "FAILED",
            errorCode,
            attemptedAt: now,
          },
        });
      } catch (error) {
        if (!isSchemaMismatch(error)) console.error("notification_attempt_unrecorded");
      }
    }
    retried += 1;
  }
  return retried;
}

export async function retryOneNotice(db: PrismaClient, notificationId: string, actorUserId: string) {
  if (!isUuid(notificationId)) return { ok: false as const, message: "That delivery was not found." };
  const now = new Date();
  try {
    const row = await db.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        channel: true,
        status: true,
        errorCode: true,
        attemptCount: true,
        title: true,
        preview: true,
        type: true,
        recipient: { select: { email: true, phoneE164: true, status: true, deletedAt: true } },
      },
    });
    if (!row || row.channel !== "EMAIL") return { ok: false as const, message: "That delivery cannot be retried." };
    if (row.status !== "FAILED" || row.errorCode !== "provider_failed" || row.attemptCount >= MAX_DELIVERY_ATTEMPTS) {
      return { ok: false as const, message: "This delivery is not eligible for another attempt." };
    }
    if (SECURITY_TYPES.includes(row.type)) return { ok: false as const, message: "Security messages must be requested again. They are not retried." };
    const claimed = await db.notification.updateMany({
      where: { id: row.id, status: "FAILED", attemptCount: row.attemptCount },
      data: { status: "QUEUED", nextRetryAt: null },
    });
    if (claimed.count !== 1) return { ok: false as const, message: "That delivery changed before it could be retried." };
    const user = row.recipient;
    let delivered = false;
    let errorCode: string | null = "provider_failed";
    if (!user || user.deletedAt || user.status === "DISABLED") {
      errorCode = "invalid_destination";
    } else if (row.channel === "EMAIL") {
      const result = await sendCareCircleEmail({ to: user.email, subject: row.title, text: row.preview ?? row.title });
      delivered = result.delivered;
      errorCode = result.delivered ? null : result.reason;
    } else {
      errorCode = "invalid_destination";
    }
    const attempt = row.attemptCount + 1;
    await db.notification.update({
      where: { id: row.id },
      data: {
        status: delivered ? "SENT" : "FAILED",
        attemptCount: attempt,
        errorCode,
        nextRetryAt: delivered ? null : nextRetryAt(attempt, now, errorCode),
      },
    });
    await db.auditLog.create({
      data: {
        actorUserId,
        action: "notification.retry",
        entityType: "Notification",
        entityId: row.id,
        metadata: { channel: row.channel, result: delivered ? "sent" : errorCode },
      },
    });
    return { ok: delivered, message: delivered ? "The provider accepted another attempt." : "The provider did not accept another attempt." };
  } catch (error) {
    if (isSchemaMismatch(error)) return { ok: false as const, message: "Delivery retry is not available until the notification migration is applied." };
    console.error("notification_retry_failed");
    return { ok: false as const, message: "The delivery could not be retried." };
  }
}
