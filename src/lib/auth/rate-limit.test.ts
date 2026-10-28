import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("rate limiting", () => {
  it("blocks requests after the limit inside the window", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });
    expect(limiter.check("register:ip", 0).allowed).toBe(true);
    expect(limiter.check("register:ip", 10).allowed).toBe(true);
    const blocked = limiter.check("register:ip", 20);
    expect(blocked.allowed).toBe(false);
    expect(limiter.check("register:other", 20).allowed).toBe(true);
    expect(limiter.check("register:ip", 1_100).allowed).toBe(true);
  });
});
