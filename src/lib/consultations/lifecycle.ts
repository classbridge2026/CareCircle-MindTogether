import type { PrismaClient } from "@prisma/client";
import { sanitizeMetadata } from "@/lib/admin/rules";
import { openConsultationEncounter, syncEncounterStatus } from "@/lib/clinical/records";
import { consultationRoomName } from "./eligibility";
import { readLiveKitConfig } from "@/lib/livekit/config";
import { closeConsultationRoom } from "@/lib/livekit/server";

async function audit(
  db: PrismaClient,
  input: { actorUserId?: string | null; appointmentId: string; action: string; metadata?: Record<string, string | number | boolean | null> },
) {
  await db.auditLog.create({
    data: {
      actorUserId: input.actorUserId || null,
      action: input.action,
      entityType: "Appointment",
      entityId: input.appointmentId,
      metadata: sanitizeMetadata(input.metadata ?? null) ?? undefined,
    },
  });
}

export async function closeOnlineRoom(
  db: PrismaClient,
  input: { appointmentId: string; actorUserId?: string | null; reason: "completed" | "cancelled" | "no_show" | "rescheduled" },
  closeRoom?: (roomName: string) => Promise<void>,
) {
  const row = await db.appointment.findUnique({
    where: { id: input.appointmentId },
    select: { id: true, mode: true },
  });
  if (!row || row.mode !== "ONLINE") return;
  const roomName = consultationRoomName(row.id);
  if (!roomName) return;
  const config = closeRoom ? null : readLiveKitConfig();
  if (!closeRoom && !config?.ok) return;
  try {
    if (closeRoom) await closeRoom(roomName);
    else if (config?.ok) await closeConsultationRoom(config.config, roomName);
    await audit(db, {
      actorUserId: input.actorUserId,
      appointmentId: row.id,
      action: "consultation.room_closed",
      metadata: { reason: input.reason },
    });
  } catch {
    await audit(db, {
      actorUserId: input.actorUserId,
      appointmentId: row.id,
      action: "consultation.room_close_failed",
      metadata: { reason: input.reason },
    }).catch(() => undefined);
  }
}

export async function applyConsultationSideEffects(
  db: PrismaClient,
  input: { actorUserId: string; appointmentId: string; to: "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "NO_SHOW"; now?: Date },
  hooks?: {
    openEncounter?: typeof openConsultationEncounter;
    closeRoom?: (roomName: string) => Promise<void>;
    notify?: (event: "ready" | "completed", appointmentId: string) => Promise<void>;
  },
) {
  try {
    const row = await db.appointment.findUnique({
      where: { id: input.appointmentId },
      select: { id: true, mode: true, status: true },
    });
    if (!row) return;
    const openEncounter = hooks?.openEncounter ?? openConsultationEncounter;
    const notify = hooks?.notify;
    if (input.to === "CHECKED_IN" && row.mode === "ONLINE") {
      await notify?.("ready", row.id);
    }
    if (input.to === "IN_PROGRESS") {
      await openEncounter(db, { appointmentId: row.id, actorUserId: input.actorUserId, now: input.now });
      await audit(db, {
        actorUserId: input.actorUserId,
        appointmentId: row.id,
        action: "consultation.started",
        metadata: { mode: row.mode },
      });
    }
    if (input.to === "COMPLETED") {
      try {
        await db.encounter.updateMany({
          where: { appointmentId: row.id, endedAt: null },
          data: { endedAt: input.now ?? new Date(), status: "COMPLETED" },
        });
        await audit(db, {
          actorUserId: input.actorUserId,
          appointmentId: row.id,
          action: "consultation.completed",
          metadata: { mode: row.mode },
        });
        await notify?.("completed", row.id);
      } catch {
        console.error("consultation_complete_record_failed");
      }
      await closeOnlineRoom(db, { appointmentId: row.id, actorUserId: input.actorUserId, reason: "completed" }, hooks?.closeRoom);
    }
    if (input.to === "NO_SHOW") {
      await syncEncounterStatus(db, { appointmentId: row.id, status: "CANCELLED", at: input.now ?? new Date() });
      await closeOnlineRoom(db, { appointmentId: row.id, actorUserId: input.actorUserId, reason: "no_show" }, hooks?.closeRoom);
    }
  } catch {
    console.error("consultation_side_effect_failed");
  }
}
