import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { diaryEntries, entryRatingHistory, films } from "@/db/schema";
import { isUnreleased } from "./films";
import { revalidateAfterEntryChange } from "./revalidate";
import { syncUserTier } from "./taste";

export type NewEntry = {
  userId: string;
  /** for the profile path revalidated afterwards */
  username: string;
  filmId: string;
  watchedOn?: string | null;
  /** tenths */
  rating?: number | null;
  review?: string | null;
  spoiler?: boolean;
  private?: boolean;
  rewatch?: boolean;
};

export type EntryResult =
  | { ok: true; entry: typeof diaryEntries.$inferSelect }
  | { ok: false; status: number; error: string };

/**
 * Writes one viewing, with the checks that make it an honest one.
 *
 * Shared rather than copied, because the failure mode of a second copy is
 * silent: a diary that accepts a film nobody could have seen yet, or a rank
 * that quietly stops moving.
 */
export async function createEntry(input: NewEntry): Promise<EntryResult> {
  const film = (
    await db
      .select({ id: films.id, title: films.title, releaseDate: films.releaseDate })
      .from(films)
      .where(eq(films.id, input.filmId))
      .limit(1)
  )[0];
  if (!film) return { ok: false, status: 404, error: "Film not found." };

  // Enforced here rather than only in the UI: the field is disabled on the
  // film page, but this is the thing that actually writes, and a record that
  // claims someone watched a film before it existed is exactly the kind of
  // dishonesty this diary is built to refuse.
  if (isUnreleased(film)) {
    return {
      ok: false,
      status: 409,
      error: `${film.title} isn't out yet. It can be logged once it's released.`,
    };
  }

  const created = await db
    .insert(diaryEntries)
    .values({
      userId: input.userId,
      filmId: input.filmId,
      watchedOn: input.watchedOn ?? null,
      rating: input.rating ?? null,
      review: input.review ?? null,
      spoiler: input.spoiler ?? false,
      private: input.private ?? false,
      rewatch: input.rewatch ?? false,
    })
    .returning();

  await syncUserTier(input.userId);
  revalidateAfterEntryChange(input.username);
  return { ok: true, entry: created[0] };
}

export type EntryChanges = {
  watchedOn?: string | null;
  rating?: number | null;
  review?: string | null;
  spoiler?: boolean;
  private?: boolean;
  rewatch?: boolean;
};

/**
 * Changes a viewing, keeping any opinion it is replacing.
 *
 * Shared by every path that can move a rating — the edit sheet and dragging a
 * film to a new place on the shelf — because the rule it enforces is the one
 * this diary is least able to afford getting wrong. Overwriting a 7.8 with an
 * 8.4 and leaving nothing behind saying it was ever a 7.8 is data loss, not a
 * shortcut, so the superseded value is recorded first and both writes land
 * together or neither does. A second copy of this logic is a second place to
 * forget it.
 */
export async function updateEntry(
  userId: string,
  username: string,
  entryId: string,
  changes: EntryChanges,
): Promise<EntryResult> {
  const existing = (
    await db
      .select({ rating: diaryEntries.rating })
      .from(diaryEntries)
      .where(and(eq(diaryEntries.id, entryId), eq(diaryEntries.userId, userId)))
      .limit(1)
  )[0];
  if (!existing) return { ok: false, status: 404, error: "Entry not found." };

  const supersedes =
    changes.rating !== undefined && changes.rating !== existing.rating && existing.rating !== null
      ? existing.rating
      : null;

  const updated = await db.transaction(async (tx) => {
    if (supersedes !== null) {
      await tx.insert(entryRatingHistory).values({ entryId, rating: supersedes });
    }
    return tx
      .update(diaryEntries)
      .set(changes)
      .where(and(eq(diaryEntries.id, entryId), eq(diaryEntries.userId, userId)))
      .returning();
  });
  if (!updated[0]) return { ok: false, status: 404, error: "Entry not found." };

  await syncUserTier(userId);
  revalidateAfterEntryChange(username);
  return { ok: true, entry: updated[0] };
}
