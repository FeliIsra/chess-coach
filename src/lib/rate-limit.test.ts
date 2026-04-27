import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  __resetRateLimitForTests,
} from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitForTests();
  });
  afterEach(() => {
    __resetRateLimitForTests();
  });

  it("allows up to max requests within the window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit("k", 3, 10_000, now + i * 100);
      expect(r.ok).toBe(true);
    }
  });

  it("rejects the (max + 1)th request inside the window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      checkRateLimit("k", 3, 10_000, now + i * 100);
    }
    const r = checkRateLimit("k", 3, 10_000, now + 400);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it("recovers after the window passes", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) {
      checkRateLimit("k", 3, 10_000, t0 + i * 100);
    }
    expect(checkRateLimit("k", 3, 10_000, t0 + 500).ok).toBe(false);

    // After window expires, all old timestamps are dropped.
    const r = checkRateLimit("k", 3, 10_000, t0 + 11_000);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("isolates buckets by key", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      checkRateLimit("a", 3, 10_000, now + i * 100);
    }
    // Different key still has fresh budget.
    expect(checkRateLimit("b", 3, 10_000, now + 400).ok).toBe(true);
    // Original key is still throttled.
    expect(checkRateLimit("a", 3, 10_000, now + 400).ok).toBe(false);
  });

  it("uses a sliding window — old entries roll off one at a time", () => {
    const t0 = 1_000_000;
    // Three hits, spaced 4s apart, window 10s.
    checkRateLimit("k", 3, 10_000, t0);
    checkRateLimit("k", 3, 10_000, t0 + 4_000);
    checkRateLimit("k", 3, 10_000, t0 + 8_000);

    // At t0 + 9_000 still within window → blocked.
    expect(checkRateLimit("k", 3, 10_000, t0 + 9_000).ok).toBe(false);

    // At t0 + 11_000 the first entry rolled off → one slot available.
    const r = checkRateLimit("k", 3, 10_000, t0 + 11_000);
    expect(r.ok).toBe(true);
  });
});
