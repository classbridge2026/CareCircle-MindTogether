import { describe, expect, it } from "vitest";
import { RECORDS_OFFLINE_MESSAGE, RecordsOfflineError, isRecordsOffline } from "./offline";

describe("records offline", () => {
  it("recognises a database the app cannot reach without repeating the server address", () => {
    const host = "ep-still-fog-b5ooi6w0-pooler.c-7.us-east-2.aws.neon.tech:5432";
    const error = Object.assign(new Error(`Can't reach database server at \`${host}\``), { code: "P1001" });
    expect(isRecordsOffline(error)).toBe(true);
    expect(isRecordsOffline(new RecordsOfflineError())).toBe(true);
    expect(isRecordsOffline(new Error("Response from the Engine was empty"))).toBe(true);
    expect(isRecordsOffline(Object.assign(new Error("connect ETIMEDOUT"), { code: "P1001" }))).toBe(true);
    expect(RECORDS_OFFLINE_MESSAGE).not.toContain(host);
    expect(RECORDS_OFFLINE_MESSAGE).not.toContain("Prisma");
  });

  it("leaves other database errors alone", () => {
    expect(isRecordsOffline(Object.assign(new Error("Unique constraint"), { code: "P2002" }))).toBe(false);
    expect(isRecordsOffline(null)).toBe(false);
  });
});
