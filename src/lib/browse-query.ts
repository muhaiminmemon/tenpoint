/**
 * Running a browse query. Split from `browse.ts` because this half reaches the
 * database and TMDB, and the filter bar is a client component: importing the
 * two together dragged `postgres` into the browser bundle and the build
 * refused it. Constants and URL parsing stay pure; anything that fetches lives
 * here.
 */
import { and, desc, gte, isNotNull, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { films } from "@/db/schema";
import { discoverMovies, type DiscoverPage, type TmdbMovie } from "./tmdb";
import {
  BROWSE_GENRES,
  RUNTIMES,
  SORTS,
  normalise,
  type BrowseFilters,
} from "./browse";

/**
 * A vote floor, applied to every query and raised for rating sorts.
 *
 * `vote_average.desc` with no floor is the classic way to get a useless list:
 * films with two votes averaging 10.0 outrank everything ever made. The floor
 * is what makes "highest rated" mean anything at all.
 */
function voteFloor(f: BrowseFilters): number {
  if (f.sort === "rated" || f.minRating !== null) return 300;
  return 30;
}

/**
 * A film in a grid, carrying the number that grid is ordered by.
 *
 * Whichever ranking is in force, the tile shows its own score — otherwise a
 * reader is asked to trust an ordering they cannot see. Formatted here rather
 * than in the component because only this layer knows which scale it came
 * from: tenths for IMDb, a percentage for the Tomatometer.
 */
export type BrowseFilm = TmdbMovie & { score?: string };

export type BrowseResult = {
  results: BrowseFilm[];
  page: number;
  totalPages: number;
  totalResults: number;
};

export async function runBrowse(f: BrowseFilters): Promise<BrowseResult> {
  const filters = normalise(f);
  return filters.source === "tmdb" ? runTmdb(filters) : runLeaderboard(filters);
}

async function runTmdb(f: BrowseFilters): Promise<DiscoverPage> {
  const sort = SORTS.find((s) => s.key === f.sort) ?? SORTS[0];

  const params: Record<string, string> = {
    sort_by: sort.tmdb,
    page: String(f.page),
    "vote_count.gte": String(voteFloor(f)),
  };

  if (f.genre) params.with_genres = String(f.genre);
  if (f.language) params.with_original_language = f.language;

  const band = RUNTIMES.find((r) => r.key === f.runtime);
  if (band?.gte) params["with_runtime.gte"] = String(band.gte);
  if (band?.lte) params["with_runtime.lte"] = String(band.lte);

  if (f.year) {
    params.primary_release_year = String(f.year);
  } else if (f.decade) {
    params["primary_release_date.gte"] = `${f.decade}-01-01`;
    params["primary_release_date.lte"] = `${f.decade + 9}-12-31`;
  } else if (f.sort === "new") {
    // Sorting by newest without a ceiling returns films announced but not out,
    // most with no poster and nothing to say about them.
    params["primary_release_date.lte"] = new Date().toISOString().slice(0, 10);
  }

  if (f.minRating) params["vote_average.gte"] = String(f.minRating / 10);

  const page = await discoverMovies(params);
  return {
    ...page,
    results: page.results.map((m) => ({
      ...m,
      score: typeof m.vote_average === "number" && m.vote_average > 0
        ? m.vote_average.toFixed(1)
        : undefined,
    })),
  };
}

const LEADERBOARD_PER_PAGE = 24;

/**
 * The critic leaderboards, read from the local catalogue.
 *
 * These cannot run against TMDB, which holds no IMDb or Rotten Tomatoes data
 * at all, so they are ordered over scores the backfill has already fetched.
 * That makes them a ranking of what we hold rather than of everything, which
 * is why the page says so rather than implying otherwise.
 */
async function runLeaderboard(f: BrowseFilters): Promise<BrowseResult> {
  const column = f.source === "imdb" ? films.imdbRating : films.rtScore;

  const where: SQL[] = [isNotNull(column)];
  if (f.genre) {
    const name = BROWSE_GENRES.find((g) => g.id === f.genre)?.name;
    if (name) where.push(sql`${films.genres} @> ${JSON.stringify([name])}::jsonb`);
  }
  if (f.year) {
    where.push(sql`${films.year} = ${f.year}`);
  } else if (f.decade) {
    where.push(gte(films.year, f.decade), lte(films.year, f.decade + 9));
  }
  const band = RUNTIMES.find((r) => r.key === f.runtime);
  if (band?.gte) where.push(gte(films.runtime, band.gte));
  if (band?.lte) where.push(lte(films.runtime, band.lte));
  if (f.language) where.push(sql`${films.originalLanguage} = ${f.language}`);
  // Both scales happen to land on 0–100: IMDb is stored in tenths (8.8 → 88)
  // and the Tomatometer is already a percentage, so one comparison covers both.
  if (f.minRating) where.push(gte(column, f.minRating));

  const clause = and(...where);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(films)
    .where(clause);

  const rows = await db
    .select({
      tmdbId: films.tmdbId,
      title: films.title,
      posterPath: films.posterPath,
      year: films.year,
      score: column,
    })
    .from(films)
    .where(clause)
    .orderBy(desc(column), films.title)
    .limit(LEADERBOARD_PER_PAGE)
    .offset((f.page - 1) * LEADERBOARD_PER_PAGE);

  return {
    results: rows
      .filter((r) => r.tmdbId !== null)
      .map((r) => ({
        id: r.tmdbId as number,
        title: r.title,
        poster_path: r.posterPath,
        release_date: r.year ? `${r.year}-01-01` : undefined,
        // IMDb is stored in tenths, the Tomatometer as a whole percentage.
        score:
          r.score === null
            ? undefined
            : f.source === "imdb"
              ? (r.score / 10).toFixed(1)
              : `${r.score}%`,
      })),
    page: f.page,
    totalPages: Math.max(1, Math.ceil(count / LEADERBOARD_PER_PAGE)),
    totalResults: count,
  };
}
