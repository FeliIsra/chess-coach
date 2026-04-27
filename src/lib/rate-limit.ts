// Simple in-memory rate limiter for the reports endpoint.
//
// Stores submission timestamps per key (typically the client IP) in a
// process-local Map. State resets on cold start, which is fine for the
// MVP — abusive bursts get throttled within a single warm container,
// and each new container starts fresh. We accept this looseness in
// exchange for zero infra dependencies.
//
// TODO: replace with Vercel BotID + a shared store (Upstash / KV) once
// abuse warrants it. See BACKLOG-prod-review.md #26.

type Buckets = Map<string, number[]>;

const globalScope = globalThis as unknown as {
  __reportsRateLimitBuckets?: Buckets;
};

function getBuckets(): Buckets {
  if (!globalScope.__reportsRateLimitBuckets) {
    globalScope.__reportsRateLimitBuckets = new Map();
  }
  return globalScope.__reportsRateLimitBuckets;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Check whether `key` may perform another action right now.
 *
 * Sliding window: counts how many timestamps fall within the last
 * `windowMs` and rejects if the count is already at or above `max`.
 * On accept, the current timestamp is recorded.
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const buckets = getBuckets();
  const cutoff = now - windowMs;

  const previous = buckets.get(key) ?? [];
  // Drop timestamps outside the window.
  const recent = previous.filter((ts) => ts > cutoff);

  if (recent.length >= max) {
    // Already at limit — keep the trimmed list around so the next call
    // sees the same window.
    buckets.set(key, recent);
    const oldest = recent[0] ?? now;
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    return { ok: false, remaining: 0, retryAfterMs };
  }

  recent.push(now);
  buckets.set(key, recent);

  return {
    ok: true,
    remaining: Math.max(0, max - recent.length),
    retryAfterMs: 0,
  };
}

/** Test-only helper: clear all buckets. Not exported in prod paths. */
export function __resetRateLimitForTests(): void {
  getBuckets().clear();
}
