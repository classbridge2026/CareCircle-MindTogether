import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  groupAssignedOfferings,
  planOfferingPreference,
  preferenceFitsService,
  saveOfferingPreference,
} from "./consultation-preference";

const doctorId = "72fb02e5-a616-4a9b-b06e-f33f0049cad5";
const profileId = "b9db909b-c7c5-4ca4-83bb-2e258d25d476";
const specialtyId = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const onlineId = "33333333-3333-4333-8333-333333333333";
const inPersonId = "44444444-4444-4444-8444-444444444444";

describe("consultation preference", () => {
  it("groups an assigned service as online, in person, or both", () => {
    const groups = groupAssignedOfferings([
      {
        id: onlineId,
        mode: "ONLINE",
        isActive: true,
        durationMinutes: 30,
        specialtyId,
        consultationServiceId: serviceId,
        serviceName: "Follow-up",
        specialtyName: "Psychiatry",
        serviceMode: null,
      },
      {
        id: inPersonId,
        mode: "IN_PERSON",
        isActive: true,
        durationMinutes: 45,
        specialtyId,
        consultationServiceId: serviceId,
        serviceName: "Follow-up",
        specialtyName: "Psychiatry",
        serviceMode: null,
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.preference).toBe("BOTH");
    expect(groups[0]?.durationMinutes).toBe(45);
  });

  it("refuses a preference the service does not allow", () => {
    expect(preferenceFitsService("BOTH", "ONLINE")).toBe(false);
    expect(preferenceFitsService("ONLINE", "ONLINE")).toBe(true);
    expect(preferenceFitsService("BOTH", null)).toBe(true);
  });

  it("reactivates a saved mode and turns the other mode off", () => {
    const plan = planOfferingPreference(
      [
        { id: onlineId, mode: "ONLINE", isActive: false, durationMinutes: 30, price: new Prisma.Decimal("10"), priceAmountMinor: 1000, currency: "SLL", notes: null },
        { id: inPersonId, mode: "IN_PERSON", isActive: true, durationMinutes: 30, price: new Prisma.Decimal("10"), priceAmountMinor: 1000, currency: "SLL", notes: null },
      ],
      ["ONLINE"],
    );
    expect(plan.activateIds).toEqual([onlineId]);
    expect(plan.deactivateIds).toEqual([inPersonId]);
    expect(plan.createModes).toEqual([]);
  });

  it("adds the missing mode when the doctor chooses both", async () => {
    const created: Array<Record<string, unknown>> = [];
    const updated: Array<{ id: string; isActive?: boolean; consultationModes?: string[] }> = [];
    const tx = {
      doctorOffering: {
        update: async ({ where, data }: { where: { id: string }; data: { isActive?: boolean } }) => {
          updated.push({ id: where.id, ...data });
          return data;
        },
        findFirst: async () => null,
        findMany: async () => [{ mode: "ONLINE" }, { mode: "IN_PERSON" }],
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: inPersonId, ...data };
        },
      },
      doctorProfile: {
        update: async ({ data }: { data: { consultationModes: string[] } }) => {
          updated.push({ id: profileId, consultationModes: data.consultationModes });
          return data;
        },
      },
      auditLog: { create: async () => ({ id: "audit" }) },
    };
    const db = {
      doctorProfile: {
        findUnique: async () => ({
          id: profileId,
          verificationStatus: "APPROVED",
          user: { status: "ACTIVE", deletedAt: null },
        }),
      },
      consultationService: { findUnique: async () => ({ isActive: true, mode: null }) },
      doctorSpecialty: { findFirst: async () => ({ claimStatus: "VERIFIED", specialty: { isActive: true } }) },
      doctorOffering: {
        findMany: async () => [
          {
            id: onlineId,
            mode: "ONLINE",
            isActive: true,
            durationMinutes: 30,
            price: new Prisma.Decimal("25.00"),
            priceAmountMinor: 2500,
            currency: "SLL",
            notes: "Bring notes",
          },
        ],
      },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    };

    const result = await saveOfferingPreference(
      doctorId,
      { specialtyId, consultationServiceId: serviceId, preference: "BOTH" },
      { db: db as never },
    );

    expect(result.ok).toBe(true);
    expect(created[0]).toMatchObject({ mode: "IN_PERSON", priceAmountMinor: 2500, notes: "Bring notes", isActive: true });
    expect(updated.some((row) => row.consultationModes?.includes("ONLINE") && row.consultationModes?.includes("IN_PERSON"))).toBe(true);
  });
});
