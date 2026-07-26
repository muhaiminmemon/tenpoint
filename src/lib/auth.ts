import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { emailTokens, sessions, users, type SessionUser } from "@/db/schema";

const scrypt = promisify(scryptCb);
const SESSION_COOKIE = "tp_session";
const SESSION_DAYS = 90;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * A real hash of a value nobody knows, verified against when the submitted
 * username doesn't exist. Without this, a miss returns before scrypt runs and
 * the response time tells an attacker which usernames are registered.
 */
const DUMMY_HASH = `${"00".repeat(16)}:${"00".repeat(64)}`;

export async function burnPasswordTiming(password: string): Promise<void> {
  await verifyPassword(password, DUMMY_HASH);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Columns that make up a `SessionUser`: everything but the password hash. */
const sessionUserColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  email: users.email,
  bio: users.bio,
  avatarUpdatedAt: users.avatarUpdatedAt,
  emailVerifiedAt: users.emailVerifiedAt,
  privacy: users.privacy,
  commentPermission: users.commentPermission,
  showDiaryOnProfile: users.showDiaryOnProfile,
  showWatchlistOnProfile: users.showWatchlistOnProfile,
  createdAt: users.createdAt,
};

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Signs out every device except the one making the request. Called after a
 * password change, so a stolen session dies with the password that leaked it.
 */
export async function destroyOtherSessions(userId: string): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const current = token ? hashToken(token) : null;
  await db
    .delete(sessions)
    .where(
      current
        ? and(eq(sessions.userId, userId), ne(sessions.tokenHash, current))
        : eq(sessions.userId, userId),
    );
}

/** Signs out every device, including this one. Used by password reset. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Deletes rows whose expiry has passed. Sessions are only ever read by exact
 * token, so an expired row is already inert; this exists to stop the table
 * growing without bound. Runs opportunistically, at most hourly per instance.
 */
let lastSessionSweep = 0;
const SESSION_SWEEP_INTERVAL_MS = 60 * 60_000;

async function sweepExpiredSessions(): Promise<void> {
  const now = Date.now();
  if (now - lastSessionSweep < SESSION_SWEEP_INTERVAL_MS) return;
  lastSessionSweep = now;
  try {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    await db.delete(emailTokens).where(lt(emailTokens.expiresAt, new Date()));
  } catch {
    // Housekeeping must never fail a request that was otherwise fine.
  }
}

/**
 * Deduped per request: the nav and the page both ask for the viewer, and
 * without `cache` that is two identical session joins on every render.
 */
export const getSessionUser = cache(async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: sessionUserColumns, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
    return null;
  }
  void sweepExpiredSessions();
  return row.user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

/* -------------------------------------------------------------------------- */
/* Email tokens                                                               */
/* -------------------------------------------------------------------------- */

export type TokenKind = "verify" | "reset";

const TOKEN_TTL_MS: Record<TokenKind, number> = {
  verify: 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
};

/**
 * Issues a single-use token and returns the plaintext, which only ever exists
 * in the email. Any older unused token of the same kind is dropped first, so
 * requesting a new link invalidates the previous one.
 */
export async function issueEmailToken(userId: string, kind: TokenKind): Promise<string> {
  await db.delete(emailTokens).where(and(eq(emailTokens.userId, userId), eq(emailTokens.kind, kind)));
  const token = randomBytes(32).toString("hex");
  await db.insert(emailTokens).values({
    tokenHash: hashToken(token),
    userId,
    kind,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS[kind]),
  });
  return token;
}

/**
 * Redeems a token, returning the user id it belonged to. Marks it used in the
 * same statement that checks it, so two concurrent redemptions can't both win.
 */
export async function consumeEmailToken(
  token: string,
  kind: TokenKind,
): Promise<string | null> {
  const rows = await db
    .update(emailTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(emailTokens.tokenHash, hashToken(token)),
        eq(emailTokens.kind, kind),
        // `usedAt is null` is what makes this single-use under concurrency
        isNull(emailTokens.usedAt),
      ),
    )
    .returning({ userId: emailTokens.userId, expiresAt: emailTokens.expiresAt });

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt < new Date()) return null;
  return row.userId;
}
