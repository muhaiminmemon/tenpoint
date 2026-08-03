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

/**
 * Handed to the page. It shows six at a time and keeps the rest for the
 * shuffle, so the surplus is doing two jobs: absorbing the films somebody has
 * already seen, and giving the button somewhere to go.
 */
const SHOW = 12;
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
export type SimilarResult = {
  films: SimilarFilm[];
  /**
   * How many close films were dropped because the viewer has already logged
   * them.
   *
   * Reported rather than swallowed. Hiding them is right — the rail is for
   * what to watch next — but hiding them silently makes the model look
   * ignorant of the obvious answer: somebody who has seen Rush opens Ford v
   * Ferrari, does not see Rush, and concludes the thing cannot tell that two
   * racing films are alike. It ranked Rush first.
   */
  alreadySeen: number;
};

export async function similarTo(
  filmId: string,
  viewerId: string | null,
): Promise<SimilarResult> {
  const [row] = await db
    .select({ similar: films.similarFilms })
    .from(films)
    .where(eq(films.id, filmId))
    .limit(1);

  const list = row?.similar ?? [];
  if (list.length === 0) return { films: [], alreadySeen: 0 };

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
  let alreadySeen = 0;
  // Stored order is the ranking; this walks it and drops what does not apply.
  for (const entry of list) {
    const film = bySlug.get(entry.slug);
    if (!film || !film.posterPath) continue;
    if (seen.has(film.id)) {
      alreadySeen++;
      continue;
    }
    if (out.length >= SHOW) continue;
    out.push({
      slug: film.slug,
      title: film.title,
      year: film.year,
      posterPath: film.posterPath,
      why: entry.why,
    });
  }

  // Three posters is a row; two is an accident. Below that the rail shows no
  // posters, but it still says how many it held back: a heavy diary can log
  // most of a film's neighbours, and an empty space explains nothing while
  // "nine of these are already in your diary" explains everything.
  return { films: out.length >= MIN ? out : [], alreadySeen };
}
