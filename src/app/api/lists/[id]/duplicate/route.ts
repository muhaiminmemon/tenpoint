import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { listItems, listMembers, lists } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { roleIn } from "@/lib/lists";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

/**
 * A copy of a list, owned by whoever asked for it.
 *
 * Anyone who can *read* the list can copy it, which is deliberately weaker than
 * the rule for changing one: a copy touches nothing on the original, and taking
 * a friend's shelf as the start of your own is the ordinary reason to want a
 * list at all.
 *
 * What does not come across is as considered as what does. Members do not: this
 * is your copy, not a second shared room, and silently re-adding somebody to a
 * list they never agreed to would be a membership nobody granted. `pairKey`
 * does not: it is unique, it is the identity of one friendship's own list, and
 * copying it would either collide or hand a second list that pair's name. Notes
 * and order do, because they are the content — a list stripped of the reason
 * each title is on it is just a pile.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "list-create", LIMITS.write, user.id);
  if (limited) return limited;

  const { id } = await ctx.params;
  if ((await roleIn(id, user.id)) === null) {
    return NextResponse.json({ error: "That list isn't yours to copy." }, { status: 403 });
  }

  const source = (await db.select().from(lists).where(eq(lists.id, id)).limit(1))[0];
  if (!source) return NextResponse.json({ error: "No such list." }, { status: 404 });

  const items = await db
    .select({ filmId: listItems.filmId, note: listItems.note, position: listItems.position })
    .from(listItems)
    .where(eq(listItems.listId, id))
    .orderBy(asc(listItems.position), asc(listItems.createdAt));

  const created = (
    await db
      .insert(lists)
      .values({
        ownerId: user.id,
        title: `${source.title} (copy)`.slice(0, 120),
        description: source.description,
      })
      .returning()
  )[0];

  await db.insert(listMembers).values({ listId: created.id, userId: user.id, role: "owner" });

  if (items.length) {
    await db.insert(listItems).values(
      items.map((it, i) => ({
        listId: created.id,
        filmId: it.filmId,
        addedBy: user.id,
        // Renumbered from the read order rather than copied, so a source list
        // whose positions were all left at the 0 default still lands in the
        // order it was actually shown in.
        position: i,
        note: it.note,
      })),
    );
  }

  return NextResponse.json({ list: created, copied: items.length });
}
