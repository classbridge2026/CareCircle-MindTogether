export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

export type RateLimiter = {
  check: (key: string, now?: number) => RateLimitDecision;
  reset: () => void;
};

export function createRateLimiter(options: { limit: number; windowMs: number }): RateLimiter {
  const buckets = new Map<string, number[]>();

  return {
    check(key, now = Date.now()) {
      const windowStart = now - options.windowMs;
      const recent = (buckets.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
      if (recent.length >= options.limit) {
        buckets.set(key, recent);
        return { allowed: false, retryAfterMs: Math.max(0, recent[0] + options.windowMs - now) };
      }
      recent.push(now);
      buckets.set(key, recent);
      return { allowed: true };
    },
    reset() {
      buckets.clear();
    },
  };
}

const limiters = new Map<string, RateLimiter>();

export function sharedRateLimiter(name: string, options: { limit: number; windowMs: number }): RateLimiter {
  const existing = limiters.get(name);
  if (existing) {
    return existing;
  }
  const created = createRateLimiter(options);
  limiters.set(name, created);
  return created;
}

export function resetSharedRateLimiters(): void {
  for (const limiter of limiters.values()) {
    limiter.reset();
  }
}
