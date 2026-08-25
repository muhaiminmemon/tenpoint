import { eq } from "drizzle-orm";
import { db } from "@/db";
import { diaryEntries, films } from "@/db/schema";
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
