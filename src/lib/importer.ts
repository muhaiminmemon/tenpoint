import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { diaryEntries, films } from "@/db/schema";
import type { ImportRow } from "./letterboxd";
import { releaseYear, searchMovies } from "./tmdb";

export type Match = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  /**
   * The TMDB season this row is, when it is one.
   *
   * An anime export names a season of a series, not the series, so `tmdbId`
   * is the *show* and this says which season of it the score belongs to. Null
   * or absent means the row is a film and `tmdbId` is the film.
   */
  season?: number | null;
};

export type ImportPayload = {
  rows: ImportRow[];
  /** keyed by filmKey; null = attempted and not found; absent = not yet attempted */
  matches: Record<string, Match | null>;
};

export function filmKey(row: { name: string; year: number | null }): string {
  return `${row.name.toLowerCase()}|${row.year ?? ""}`;
}

/** Match one film: local cache first, then TMDB search. */
export async function matchFilm(name: string, year: number | null): Promise<Match | null> {
  const local = await db
    .select()
    .from(films)
    .where(
      and(
        isNotNull(films.tmdbId),
        sql`lower(${films.title}) = ${name.toLowerCase()}`,
        year
          ? sql`${films.year} between ${year - 1} and ${year + 1}`
          : sql`true`,
      ),
    )
    .limit(1);
  if (local[0]?.tmdbId) {
    return {
      tmdbId: local[0].tmdbId,
      title: local[0].title,
      year: local[0].year,
      posterPath: local[0].posterPath,
    };
  }

  const pick = (results: Awaited<ReturnType<typeof searchMovies>>) => {
    if (!results.length) return null;
    // Letterboxd and TMDB sometimes disagree by a year (festival vs release)
    const within = year
      ? results.find((r) => {
          const y = releaseYear(r);
          return y !== null && Math.abs(y - year) <= 1;
        })
      : results[0];
    return within ?? null;
  };

  let hit = year ? pick(await searchMovies(name, year)) : null;
  if (!hit) hit = pick(await searchMovies(name));
  if (!hit) return null;
  return {
    tmdbId: hit.id,
    title: hit.title,
    year: releaseYear(hit),
    posterPath: hit.poster_path ?? null,
  };
}

export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Film ids the user has logged at all, and the subset with any rated entry. */
export async function userFilmSets(userId: string): Promise<{
  logged: Set<string>;
  rated: Set<string>;
}> {
  const rows = await db
    .select({
      filmId: diaryEntries.filmId,
      hasRating: sql<boolean>`bool_or(${diaryEntries.rating} is not null)`,
    })
    .from(diaryEntries)
    .where(eq(diaryEntries.userId, userId))
    .groupBy(diaryEntries.filmId);
  const logged = new Set<string>();
  const rated = new Set<string>();
  for (const r of rows) {
    logged.add(r.filmId);
    if (r.hasRating) rated.add(r.filmId);
  }
  return { logged, rated };
}

export async function filmsByTmdbIds(tmdbIds: number[]): Promise<Map<number, string>> {
  if (!tmdbIds.length) return new Map();
  const rows = await db
    .select({ id: films.id, tmdbId: films.tmdbId })
    .from(films)
    .where(inArray(films.tmdbId, tmdbIds));
  return new Map(rows.filter((r) => r.tmdbId !== null).map((r) => [r.tmdbId!, r.id]));
}
