import { NextResponse } from "next/server";

/**
 * Fixed-window counters held in process memory.
 *
 * Deliberately not Redis: this runs as a single long-lived Node server, where
 * an in-process map is exact, free, and has no failure mode of its own. The
 * tradeoff is that it does not span instances, so if this is ever deployed
 * behind more than one replica the effective limit multiplies by the replica
 * count. That is still a hard ceiling per attacker rather than none, and the
 * swap to a shared store is confined to `hit()` below.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Cheap amortised cleanup: the map only grows while a window is open, and a
// sweep every 5 minutes keeps a burst of unique IPs from pinning memory.
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 5 * 60_000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimit = {
  /** How many requests are allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets; what goes in `Retry-After`. */
  retryAfter: number;
};

function hit(key: string, { limit, windowSec }: RateLimit): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    ok: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfter,
  };
}

/**
 * The caller's IP, from the proxy headers a platform sets. Every value here is
 * client-controllable in a direct-to-Node deployment, so this is an abuse
 * speed bump, never an identity: nothing security-critical keys off it.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Applies a limit and returns a ready-to-send 429, or null to continue.
 *
 * ```ts
 * const limited = enforceRateLimit(req, "login", LIMITS.auth);
 * if (limited) return limited;
 * ```
 */
export function enforceRateLimit(
  req: Request,
  scope: string,
  limit: RateLimit,
  /** Extra key material, e.g. a user id, so limits are per-account not per-IP. */
  discriminator?: string,
): NextResponse | null {
  const key = `${scope}:${discriminator ?? clientIp(req)}`;
  const result = hit(key, limit);
  if (result.ok) return null;

  return NextResponse.json(
    { error: "Too many attempts. Wait a moment and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(limit.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

/** Named limits, kept together so the whole policy is readable in one place. */
export const LIMITS = {
  /** Sign-in and anything else guessing at a credential. */
  auth: { limit: 10, windowSec: 300 },
  /** Account creation, which is expensive to undo. */
  signup: { limit: 5, windowSec: 3600 },
  /** Sending mail costs money and lands in someone else's inbox. */
  email: { limit: 4, windowSec: 3600 },
  /** Fans out to ~17 TMDB calls, so this protects a third-party quota too. */
  recs: { limit: 20, windowSec: 300 },
  /** Whole-file uploads. */
  imports: { limit: 30, windowSec: 3600 },
  /**
   * The matching loop, which the client drives 30 titles at a time. A large
   * back catalogue is legitimately hundreds of calls, so this is sized to let
   * a real import finish while still bounding a runaway loop.
   */
  importMatch: { limit: 500, windowSec: 3600 },
  /** User-visible writes: comments, reports, friend requests. */
  write: { limit: 60, windowSec: 300 },
  /** Reads that hit a third party or scan the users table. */
  search: { limit: 120, windowSec: 60 },
} satisfies Record<string, RateLimit>;
