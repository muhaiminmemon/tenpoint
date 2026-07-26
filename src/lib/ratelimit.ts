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
 * How many proxies sit in front of this app, and therefore how many trailing
 * `X-Forwarded-For` entries were written by infrastructure rather than by the
 * caller.
 *
 * Railway terminates TLS and forwards once, so production defaults to 1. A CDN
 * in front of that makes it 2 — override with `TRUSTED_PROXY_HOPS`.
 *
 * Development defaults to **0**, meaning `X-Forwarded-For` is ignored
 * completely. That matters: running with no proxy, the header is pure client
 * input, and trusting it would let anyone reset every limit here by sending a
 * different value each request. With 0 hops there's no trustworthy address
 * available at all, so every caller shares one bucket — a blunt limit, but an
 * honest one, and never a bypass.
 */
function trustedProxyHops(): number {
  const configured = process.env.TRUSTED_PROXY_HOPS;
  if (configured !== undefined) {
    const parsed = Number(configured);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return process.env.NODE_ENV === "production" ? 1 : 0;
}

/**
 * The caller's IP, or a shared bucket when none can be trusted.
 *
 * `X-Forwarded-For` is `client, proxy1, proxy2, …`, built left to right, with
 * each proxy *appending* the address it actually saw. The leftmost entry is
 * therefore whatever the client typed; only the trailing entries are ours.
 * We count in from the right, and only as far as we know proxies exist.
 */
export function clientIp(req: Request): string {
  const hops = trustedProxyHops();
  if (hops === 0) return "untrusted-proxy";

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    // Fall through to the shared bucket rather than reading a client-supplied
    // entry when the chain is shorter than the configured hop count.
    if (parts.length >= hops) {
      const trusted = parts[parts.length - hops];
      if (trusted) return trusted;
    }
  }
  return "untrusted-proxy";
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
