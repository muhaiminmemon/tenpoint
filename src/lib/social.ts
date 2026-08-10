import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { blocks, friendRequests, friendships, safeUserColumns, users, type SessionUser } from "@/db/schema";

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

export async function friendsOf(userId: string): Promise<SessionUser[]> {
  const ids = await friendIdsOf(userId);
  if (!ids.length) return [];
  return db.select(safeUserColumns).from(users).where(inArray(users.id, ids));
}

/** Pending incoming requests, for the badge on the Friends nav link. */
export async function pendingRequestCountFor(userId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(friendRequests)
    .where(eq(friendRequests.toId, userId));
  return rows[0]?.n ?? 0;
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

/**
 * How many works each of these people has rated.
 *
 * Works, not rows. The friends list read this off the rated-film count, which
 * counts a season as a title, so somebody who had watched three programmes
 * properly — season by season, the way this product asks — was listed beside a
 * name as "38 rated" while somebody with thirty-eight films read the same. The
 * two are not the same claim, and the larger number belonged to the smaller
 * shelf. A series counts once, which is how the profile counts it.
 *
 * Private viewings are excluded: this number is shown to other people.
 *
 * One statement for the whole list rather than one per friend, because this
 * renders a row per friend and the page already runs a query each.
 */
export async function ratedTitleCounts(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await db.execute(sql`
    with current as (
      select distinct on (d.user_id, d.film_id) d.user_id, d.film_id
      from diary_entries d
      where d.user_id in ${userIds} and d.rating is not null and d.private = false
      order by d.user_id, d.film_id, d.watched_on desc nulls last, d.created_at desc
    )
    select c.user_id, count(distinct coalesce(f.show_id, f.id))::int as titles
    from current c join films f on f.id = c.film_id
    group by c.user_id
  `);
  const out = new Map<string, number>();
  for (const r of rows as unknown as { user_id: string; titles: number }[]) {
    out.set(r.user_id, Number(r.titles));
  }
  return out;
}
