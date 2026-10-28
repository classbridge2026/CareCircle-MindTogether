import type { PrismaClient } from "@prisma/client";
import { isSchemaMismatch } from "@/lib/doctors/errors";
import { MAX_DELIVERY_ATTEMPTS } from "./delivery";

const CHANNELS = new Set(["IN_APP", "EMAIL", "SMS"]);
const STATUSES = new Set(["QUEUED", "SENT", "FAILED", "SUPPRESSED", "CANCELLED", "READ"]);

export async function listDeliveryLog(
  db: PrismaClient,
  query: { channel?: string; status?: string; type?: string; page: number },
) {
  const pageSize = 20;
  const page = Math.max(1, query.page);
  const where = {
    ...(query.channel && CHANNELS.has(query.channel) ? { channel: query.channel as "EMAIL" } : {}),
    ...(query.status && STATUSES.has(query.status) ? { status: query.status as "FAILED" } : {}),
    ...(query.type?.trim() ? { type: query.type.trim().slice(0, 80) } : {}),
  };
  try {
    const [total, rows] = await Promise.all([
      db.notification.count({ where }),
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          channel: true,
          type: true,
          status: true,
          errorCode: true,
          attemptCount: true,
          createdAt: true,
          preview: true,
          recipient: { select: { email: true } },
        },
      }),
    ]);
    return {
      ok: true as const,
      unavailable: false,
      page,
      pageSize,
      total,
      rows: rows.map((row) => ({
        id: row.id,
        channel: row.channel,
        type: row.type,
        status: row.status,
        errorCode: row.errorCode,
        attemptCount: row.attemptCount,
        createdAt: row.createdAt.toISOString(),
        preview: row.preview,
        recipient: row.recipient.email,
        retryable: row.channel === "EMAIL" && row.status === "FAILED" && row.errorCode === "provider_failed" && row.attemptCount < MAX_DELIVERY_ATTEMPTS,
      })),
    };
  } catch (error) {
    if (isSchemaMismatch(error)) {
      return { ok: true as const, unavailable: true, page, pageSize, total: 0, rows: [] };
    }
    return { ok: false as const, unavailable: false, page, pageSize, total: 0, rows: [] };
  }
}
