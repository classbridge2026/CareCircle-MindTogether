import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { archivePatientAccount } from "./patient-accounts";

const actor = { userId: "11111111-1111-4111-8111-111111111111", roleCodes: ["SUPER_ADMIN"] };
const patientId = "050a6736-1d81-4bb7-a0de-e7da2e5cd29f";
const userId = "5c134b07-ded2-4959-9f76-8459a0f6c9b3";

describe("archivePatientAccount", () => {
  it("archives a profile whose login was already closed", async () => {
    const updates: Array<{ where: { id: string }; data: { archivedAt: Date } }> = [];
    const db = {
      patientProfile: {
        findUnique: async () => ({
          id: patientId,
          userId,
          archivedAt: null,
          fullName: "Crud Checked",
          user: { deletedAt: new Date("2026-10-18T19:04:05.413Z") },
        }),
        update: async (args: { where: { id: string }; data: { archivedAt: Date } }) => {
          updates.push(args);
          return args;
        },
      },
      user: { findUnique: async () => { throw new Error("login lookup is not needed"); } },
    };
    const result = await archivePatientAccount({ patientId }, { db: db as unknown as PrismaClient, actor });
    expect(result).toEqual({ ok: true, message: "Deleted Crud Checked. Appointments already stored stay available." });
    expect(updates).toHaveLength(1);
    expect(updates[0]?.where.id).toBe(patientId);
    expect(updates[0]?.data.archivedAt).toBeInstanceOf(Date);
  });
});
