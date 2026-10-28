import { describe, expect, it } from "vitest";
import { parseOptions } from "@node-rs/argon2";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("stores Argon2id and never returns the plaintext password", async () => {
    const password = "CorrectHorse12";
    const hashed = await hashPassword(password);
    expect(hashed.startsWith("$argon2id$")).toBe(true);
    expect(hashed).not.toContain(password);
    expect(parseOptions(hashed).algorithm).toBe(2);
    expect(await verifyPassword(password, hashed)).toBe(true);
    expect(await verifyPassword("WrongHorse12", hashed)).toBe(false);
  });
});
