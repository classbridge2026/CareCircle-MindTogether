import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { homeForRoles } from "./access";
import { authenticatePatient } from "./login";
import { hashPassword } from "./password";

describe("shared sign-in destinations", () => {
  it("chooses the home from stored roles, with the highest role first", () => {
    expect(homeForRoles(["PATIENT"])).toBe("/patient");
    expect(homeForRoles(["DOCTOR", "PATIENT"])).toBe("/doctor");
    expect(homeForRoles(["ADMIN"])).toBe("/admin");
    expect(homeForRoles(["PATIENT", "SUPER_ADMIN"])).toBe("/admin");
    expect(homeForRoles(["GUEST"])).toBeNull();
  });

  it("signs in with a phone number and ignores any requested role", async () => {
    const password = "CorrectHorse12";
    const passwordHash = await hashPassword(password);
    const sessions: string[] = [];
    const db = {
      user: {
        findUnique: async ({ where }: { where: { emailNormalized?: string; phoneE164?: string } }) => {
          if (where.phoneE164 !== "+23276000001") return null;
          return {
            id: "user-1",
            deletedAt: null,
            passwordHash,
            status: "ACTIVE",
            roles: [{ role: { code: "PATIENT" } }],
          };
        },
      },
      session: {
        create: async () => {
          sessions.push("created");
        },
      },
    };

    const result = await authenticatePatient(db as unknown as PrismaClient, {
      identifier: "076000001",
      password,
      now: new Date(),
      role: "SUPER_ADMIN",
    } as never);

    expect(result).toMatchObject({ ok: true, destination: "/patient" });
    expect(sessions).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("SUPER_ADMIN");
    if (result.ok) {
      expect(JSON.stringify({ destination: result.destination })).not.toContain(result.sessionToken);
    }
  });
});
