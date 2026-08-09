import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { diaryEntries, entryRatingHistory } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { revalidateAfterEntryChange } from "@/lib/revalidate";
import { syncUserTier } from "@/lib/taste";

const patchSchema = z.object({
  watchedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  rating: z.number().int().min(10).max(100).nullable().optional(),
  review: z.string().max(20000).nullable().optional(),
  spoiler: z.boolean().optional(),
  private: z.boolean().optional(),
  rewatch: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (Object.values(parsed.data).every((v) => v === undefined)) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const existing = (
    await db
      .select({ rating: diaryEntries.rating })
      .from(diaryEntries)
      .where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, user.id)))
      .limit(1)
  )[0];
  if (!existing) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  /**
   * Changing your mind is kept, not overwritten.
   *
   * This used to `set` the new rating straight over the old one, which is the
   * one thing this diary promises never to do: a 7.8 that became an 8.4 left
   * nothing behind saying it had ever been a 7.8. Recording the superseded
   * value keeps the progression without inventing a viewing that never
   * happened, which is the other way this could have gone and the way the
   * season list was already going.
   *
   * Both writes or neither. A history row for an update that failed would
   * claim an opinion moved when it did not.
   */
  const supersedes =
    parsed.data.rating !== undefined &&
    parsed.data.rating !== existing.rating &&
    existing.rating !== null
      ? existing.rating
      : null;

  const updated = await db.transaction(async (tx) => {
    if (supersedes !== null) {
      await tx.insert(entryRatingHistory).values({ entryId: id, rating: supersedes });
    }
    return tx
      .update(diaryEntries)
      .set(parsed.data)
      .where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, user.id)))
      .returning();
  });
  if (!updated[0]) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  await syncUserTier(user.id);
  revalidateAfterEntryChange(user.username);
  return NextResponse.json({ entry: updated[0] });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;

  const deleted = await db
    .delete(diaryEntries)
    .where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, user.id)))
    .returning({ id: diaryEntries.id });
  if (!deleted[0]) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  await syncUserTier(user.id);
  revalidateAfterEntryChange(user.username);
  return NextResponse.json({ ok: true });
}
