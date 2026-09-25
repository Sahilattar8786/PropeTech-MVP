import { AppError } from "./errors";

/**
 * Fixed-window rate limiter. In-memory per instance — adequate for a single
 * node; swap the store for Redis when running multiple instances.
 */
type Bucket = { count: number; resetAt: number };

const globalForLimiter = globalThis as unknown as { __rateLimit?: Map<string, Bucket> };
const buckets = globalForLimiter.__rateLimit ?? new Map<string, Bucket>();
globalForLimiter.__rateLimit = buckets;

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export function checkRateLimit(key: string, { limit, windowMs }: RateLimitOptions): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return { ok: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }
  bucket.count += 1;
  return { ok: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}

export function enforceRateLimit(key: string, options: RateLimitOptions, message = "Too many requests. Please slow down.") {
  if (!checkRateLimit(key, options).ok) throw new AppError("RATE_LIMITED", message);
}

export const RATE_LIMITS = {
  auth: { limit: 10, windowMs: 10 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  upload: { limit: 60, windowMs: 10 * 60_000 },
  track: { limit: 120, windowMs: 60_000 },
  webhook: { limit: 600, windowMs: 60_000 },
  ai: { limit: 30, windowMs: 10 * 60_000 },
} satisfies Record<string, RateLimitOptions>;

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
