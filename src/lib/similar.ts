import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { diaryEntries, films } from "@/db/schema";

export type SimilarFilm = {
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** the real overlap behind this pick, never a score */
  why: string;
};

/** Shown on the page. The stored list is longer so filtering has slack. */
const SHOW = 8;
/** Below this the rail is not worth the space it takes. */
const MIN = 3;

/**
 * The films that sit next to this one, minus the ones this person has seen.
 *
 * The ordering was worked out overnight and stored on the row, so this is one
 * indexed read and a slug lookup rather than a megabyte of vectors. See
 * `scripts/backfill-similar.mjs` for how the list is built and why each entry
 * carries a sentence.
 *
 * Filtering by what somebody has already logged is the difference between a
 * fact about the film and a suggestion they can act on. Signed out, there is
 * nothing to filter against and the unfiltered list is the honest answer.
 */
export async function similarTo(
  filmId: string,
  viewerId: string | null,
): Promise<SimilarFilm[]> {
  const [row] = await db
    .select({ similar: films.similarFilms })
    .from(films)
    .where(eq(films.id, filmId))
    .limit(1);

  const list = row?.similar ?? [];
  if (list.length === 0) return [];

  const rows = await db
    .select({
      id: films.id,
      slug: films.slug,
      title: films.title,
      year: films.year,
      posterPath: films.posterPath,
    })
    .from(films)
    .where(
      and(
        inArray(
          films.slug,
          list.map((s) => s.slug),
        ),
        ne(films.id, filmId),
      ),
    );

  const bySlug = new Map(rows.map((f) => [f.slug, f]));

  let seen = new Set<string>();
  if (viewerId && rows.length > 0) {
    const logged = await db
      .selectDistinct({ filmId: diaryEntries.filmId })
      .from(diaryEntries)
      .where(
        and(
          eq(diaryEntries.userId, viewerId),
          inArray(
            diaryEntries.filmId,
            rows.map((f) => f.id),
          ),
        ),
      );
    seen = new Set(logged.map((l) => l.filmId));
  }

  const out: SimilarFilm[] = [];
  // Stored order is the ranking; this walks it and drops what does not apply.
  for (const entry of list) {
    if (out.length >= SHOW) break;
    const film = bySlug.get(entry.slug);
    if (!film || seen.has(film.id) || !film.posterPath) continue;
    out.push({
      slug: film.slug,
      title: film.title,
      year: film.year,
      posterPath: film.posterPath,
      why: entry.why,
    });
  }

  // Three posters is a row; two is an accident. Below that the section does
  // not render at all rather than apologising for itself.
  return out.length >= MIN ? out : [];
}
