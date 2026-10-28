import { describe, expect, it } from "vitest";
import { updateSystemName } from "@/lib/admin/mutations";
import { DEFAULT_SYSTEM_NAME, parseSystemName, readStoredSystemName } from "./system-name";

describe("system name", () => {
  it("keeps a readable name and rejects markup or a blank value", () => {
    expect(parseSystemName("  City   Clinic  ")).toBe("City Clinic");
    expect(parseSystemName(DEFAULT_SYSTEM_NAME)).toBe(DEFAULT_SYSTEM_NAME);
    expect(parseSystemName("A")).toBeNull();
    expect(parseSystemName("<script>alert(1)</script>")).toBeNull();
    expect(parseSystemName("https://example.com")).toBeNull();
    expect(readStoredSystemName(null)).toBe(DEFAULT_SYSTEM_NAME);
    expect(readStoredSystemName("  Hope Health ")).toBe("Hope Health");
    expect(readStoredSystemName(12)).toBe(DEFAULT_SYSTEM_NAME);
  });

  it("lets an administrator save a name and refuses anyone else", async () => {
    const saved: Array<{ key: string; valueJson: string }> = [];
    const db = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          platformSetting: {
            upsert: async ({ create }: { create: { key: string; valueJson: string } }) => {
              saved.push(create);
              return { id: "setting-1" };
            },
          },
          auditLog: { create: async () => ({}) },
        }),
    };
    const denied = await updateSystemName("City Clinic", {
      db: db as never,
      actor: { userId: "patient", roleCodes: ["PATIENT"] },
    });
    const invalid = await updateSystemName(" ", {
      db: db as never,
      actor: { userId: "admin", roleCodes: ["ADMIN"] },
    });
    const savedResult = await updateSystemName("  City   Clinic ", {
      db: db as never,
      actor: { userId: "admin", roleCodes: ["ADMIN"] },
    });
    expect(denied.ok).toBe(false);
    expect(invalid.ok).toBe(false);
    expect(savedResult).toEqual({ ok: true, message: "The system name is now City Clinic." });
    expect(saved).toEqual([{ key: "SYSTEM_NAME", valueJson: "City Clinic" }]);
  });
});
