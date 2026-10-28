import { afterEach, describe, expect, it } from "vitest";
import { metadataBase } from "./metadata-base";

const original = process.env.APP_BASE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = original;
});

describe("metadataBase", () => {
  it("uses APP_BASE_URL when it is an http origin", () => {
    process.env.APP_BASE_URL = "https://care.example/app";
    expect(metadataBase()?.origin).toBe("https://care.example");
    expect(metadataBase()?.pathname).toBe("/app");
  });

  it("ignores a value that is not an http URL", () => {
    process.env.APP_BASE_URL = "ftp://care.example";
    expect(metadataBase()).toBeUndefined();
    process.env.APP_BASE_URL = "not a url";
    expect(metadataBase()).toBeUndefined();
  });

  it("falls back to the local dev server when APP_BASE_URL is unset outside production", () => {
    delete process.env.APP_BASE_URL;
    expect(metadataBase()?.href).toBe("http://localhost:3000/");
  });
});
