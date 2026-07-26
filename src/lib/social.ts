import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { blocks, friendships, users, type SessionUser, type User } from "@/db/schema";

export function pairIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function pairKey(a: string, b: string): string {
  const [low, high] = pairIds(a, b);
  return `${low}:${high}`;
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const [low, high] = pairIds(a, b);
  const rows = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userLowId, low), eq(friendships.userHighId, high)))
    .limit(1);
  return rows.length > 0;
}

export async function friendIdsOf(userId: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(friendships)
    .where(or(eq(friendships.userLowId, userId), eq(friendships.userHighId, userId)));
  return rows.map((r) => (r.userLowId === userId ? r.userHighId : r.userLowId));
}

export async function friendsOf(userId: string): Promise<User[]> {
  const ids = await friendIdsOf(userId);
  if (!ids.length) return [];
  return db.select().from(users).where(inArray(users.id, ids));
}

export async function createFriendship(a: string, b: string): Promise<void> {
  if (a === b) return;
  const [low, high] = pairIds(a, b);
  await db
    .insert(friendships)
    .values({ userLowId: low, userHighId: high })
    .onConflictDoNothing();
}

export async function removeFriendship(a: string, b: string): Promise<void> {
  const [low, high] = pairIds(a, b);
  await db
    .delete(friendships)
    .where(and(eq(friendships.userLowId, low), eq(friendships.userHighId, high)));
}

/** True if either user has blocked the other. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const rows = await db
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** All user ids blocked by or blocking `userId`. */
export async function blockedIdsFor(userId: string): Promise<Set<string>> {
  const rows = await db
    .select()
    .from(blocks)
    .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
  const out = new Set<string>();
  for (const r of rows) out.add(r.blockerId === userId ? r.blockedId : r.blockerId);
  return out;
}

/** Can `viewer` (possibly null) see `profile`'s library and reviews? */
export async function canViewProfile(
  viewer: SessionUser | null,
  profile: SessionUser,
): Promise<boolean> {
  if (viewer?.id === profile.id) return true;
  if (viewer && (await isBlockedBetween(viewer.id, profile.id))) return false;
  if (profile.privacy === "public") return true;
  if (profile.privacy === "friends") {
    return viewer ? areFriends(viewer.id, profile.id) : false;
  }
  return false;
}
