import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { friendRequests, safeUserColumns, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { areFriends, createFriendship, isBlockedBetween } from "@/lib/social";

const schema = z.object({ userId: z.string().uuid() });

/** Send a friend request. If they already asked you, this accepts instead. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "friend-request", LIMITS.write, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.userId === user.id) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const otherId = parsed.data.userId;

  const other = (await db.select(safeUserColumns).from(users).where(eq(users.id, otherId)).limit(1))[0];
  if (!other || (await isBlockedBetween(user.id, otherId))) {
    return NextResponse.json({ error: "No user found." }, { status: 404 });
  }
  if (await areFriends(user.id, otherId)) {
    return NextResponse.json({ ok: true, status: "friends" });
  }

  // they already asked, so this is mutual interest: become friends
  const reverse = (
    await db
      .select()
      .from(friendRequests)
      .where(and(eq(friendRequests.fromId, otherId), eq(friendRequests.toId, user.id)))
      .limit(1)
  )[0];
  if (reverse) {
    await createFriendship(user.id, otherId);
    await db.delete(friendRequests).where(eq(friendRequests.id, reverse.id));
    return NextResponse.json({ ok: true, status: "friends" });
  }

  await db
    .insert(friendRequests)
    .values({ fromId: user.id, toId: otherId })
    .onConflictDoNothing();
  return NextResponse.json({ ok: true, status: "requested" });
}

/** Cancel your outgoing request. */
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  await db
    .delete(friendRequests)
    .where(and(eq(friendRequests.fromId, user.id), eq(friendRequests.toId, parsed.data.userId)));
  return NextResponse.json({ ok: true });
}
