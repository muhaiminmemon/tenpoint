import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { listItems, listMembers, lists, recEvents, safeUserColumns, userFilmFlags, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { areFriends, pairKey } from "@/lib/social";

const schema = z.object({
  friend: z.string().min(1),
  filmId: z.string().uuid(),
  action: z.enum(["save", "seen", "not_interested"]),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { friend: friendName, filmId, action } = parsed.data;

  const friend = (
    await db.select(safeUserColumns).from(users).where(eq(users.username, friendName.toLowerCase())).limit(1)
  )[0];
  if (!friend || !(await areFriends(user.id, friend.id))) {
    return NextResponse.json({ error: "Not friends." }, { status: 403 });
  }
  const key = pairKey(user.id, friend.id);

  if (action === "seen" || action === "not_interested") {
    await db
      .insert(userFilmFlags)
      .values({ userId: user.id, filmId, flag: action })
      .onConflictDoNothing();
    await db.insert(recEvents).values({
      pairKey: key,
      filmId,
      userId: user.id,
      event: action === "seen" ? "seen" : "dismissed",
    });
    return NextResponse.json({ ok: true });
  }

  // save → the pair's shared list, created on first save
  let list = (await db.select().from(lists).where(eq(lists.pairKey, key)).limit(1))[0];
  if (!list) {
    const created = await db
      .insert(lists)
      .values({
        ownerId: user.id,
        title: `Watching with ${friend.displayName ?? friend.username}`,
        pairKey: key,
      })
      .onConflictDoNothing({ target: lists.pairKey })
      .returning();
    list = created[0] ?? (await db.select().from(lists).where(eq(lists.pairKey, key)).limit(1))[0];
    await db
      .insert(listMembers)
      .values([
        { listId: list.id, userId: user.id, role: "owner" },
        { listId: list.id, userId: friend.id, role: "editor" },
      ])
      .onConflictDoNothing();
  }

  await db
    .insert(listItems)
    .values({ listId: list.id, filmId, addedBy: user.id })
    .onConflictDoNothing();
  await db
    .insert(recEvents)
    .values({ pairKey: key, filmId, userId: user.id, event: "saved" });

  return NextResponse.json({ ok: true, listId: list.id });
}
