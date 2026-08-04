import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { films, shows, type Film, type Show } from "@/db/schema";
import { slugify } from "./films";
import {
  formOf,
  showDetails,
  TV_GENRES_BY_ID,
  type TmdbShow,
  type TmdbShowDetails,
} from "./tmdb";

/**
 * Bringing a series into the catalogue, seasons and all.
 *
 * The unit of opinion is the season, so a season is a row in `films` and the
 * show is only what groups them. That decision is the whole design: a season
 * is something watched over a stretch of weeks, rated once, and argued about,
 * which is exactly what a film already is here. Everything downstream, the
 * diary, the watchlist, lists, rankings, the recommender and the embeddings,
 * therefore works on seasons without being told they exist.
 *
 * The alternative was a `titles` table with movies folded into it. Six tables
 * carry a foreign key into `films`; that migration would have cost weeks and
 * changed nothing anybody can see.
 */

/** Specials sit outside the run and would otherwise always be season zero. */
const SPECIALS = 0;

function yearOf(date: string | null | undefined): number | null {
  const y = Number.parseInt((date ?? "").slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

/**
 * What a season is called on its own.
 *
 * Written into the season's own title so that a diary row, a search result, a
 * list and a shared card all read correctly without any of them knowing what a
 * show is. TMDB names most seasons "Season 3" and a few something better, like
 * "The Final Season", and the better name is always worth keeping.
 */
export function seasonTitle(showName: string, seasonNumber: number, tmdbName?: string | null): string {
  const given = (tmdbName ?? "").trim();
  const generic = !given || /^season\s*\d+$/i.test(given);
  return generic ? `${showName}: Season ${seasonNumber}` : `${showName}: ${given}`;
}

/**
 * Inserts a show and one row per season, or returns what is already stored.
 *
 * Seasons carry the show's cast, genres and keywords rather than their own.
 * TMDB holds per-season credits behind another request each, and a season of a
 * series is made by substantially the same people as the series; paying twenty
 * calls to discover that would slow every first view of a show down for
 * almost no signal.
 */
export async function ensureShow(input: TmdbShow | number): Promise<Show | null> {
  const tmdbId = typeof input === "number" ? input : input.id;
  const existing = await db.select().from(shows).where(eq(shows.tmdbId, tmdbId)).limit(1);
  if (existing[0]) return existing[0];

  let details: TmdbShowDetails;
  try {
    details = await showDetails(tmdbId);
  } catch {
    return null;
  }

  const genreNames = (details.genres ?? []).map((g) => g.name);
  const first = yearOf(details.first_air_date);
  const form = formOf(genreNames, details.original_language);

  let slug = slugify(details.name, first);
  const clash = await db.select({ id: shows.id }).from(shows).where(eq(shows.slug, slug)).limit(1);
  if (clash[0]) slug = `${slug}-${tmdbId}`;

  const [show] = await db
    .insert(shows)
    .values({
      tmdbId,
      slug,
      name: details.name,
      firstAirYear: first,
      lastAirYear: yearOf(details.last_air_date),
      status: details.status ?? null,
      posterPath: details.poster_path ?? null,
      backdropPath: details.backdrop_path ?? null,
      overview: details.overview ?? null,
      originalLanguage: details.original_language ?? null,
      genres: genreNames,
      keywords: (details.keywords?.results ?? []).map((k) => k.name).slice(0, 25),
      castNames: (details.credits?.cast ?? [])
        .slice()
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
        .slice(0, 10)
        .map((c) => c.name),
      creators: (details.created_by ?? []).map((c) => c.name),
      seasonCount: details.number_of_seasons ?? null,
      episodeCount: details.number_of_episodes ?? null,
      form,
      popularity: details.popularity ?? null,
      voteCount: details.vote_count ?? null,
      refreshedAt: new Date(),
    })
    .onConflictDoNothing({ target: shows.tmdbId })
    .returning();

  if (!show) {
    const won = await db.select().from(shows).where(eq(shows.tmdbId, tmdbId)).limit(1);
    return won[0] ?? null;
  }

  const seasons = (details.seasons ?? [])
    .filter((s) => s.season_number !== SPECIALS && (s.episode_count ?? 0) > 0)
    .sort((a, b) => a.season_number - b.season_number);

  if (seasons.length) {
    await db
      .insert(films)
      .values(
        seasons.map((s) => {
          const title = seasonTitle(show.name, s.season_number, s.name);
          return {
            kind: "season" as const,
            tmdbId: s.id,
            showId: show.id,
            seasonNumber: s.season_number,
            episodeCount: s.episode_count ?? null,
            slug: `${show.slug}-season-${s.season_number}`,
            title,
            year: yearOf(s.air_date) ?? first,
            releaseDate: s.air_date || null,
            originalLanguage: show.originalLanguage,
            posterPath: s.poster_path ?? show.posterPath,
            backdropPath: show.backdropPath,
            overview: s.overview || show.overview,
            genres: show.genres,
            keywords: show.keywords,
            castNames: show.castNames,
            director: show.creators?.[0] ?? null,
            popularity: show.popularity,
            voteCount: show.voteCount,
          };
        }),
      )
      .onConflictDoNothing();
  }

  return show;
}

export type ShowWithSeasons = { show: Show; seasons: Film[] };

/** A show and its seasons in order, for the show page. */
export async function loadShow(slug: string): Promise<ShowWithSeasons | null> {
  const [show] = await db.select().from(shows).where(eq(shows.slug, slug)).limit(1);
  if (!show) return null;
  const seasons = await db
    .select()
    .from(films)
    .where(and(eq(films.showId, show.id), eq(films.kind, "season")))
    .orderBy(asc(films.seasonNumber));
  return { show, seasons };
}

/** The genre names for a list result, from TMDB's separate television taxonomy. */
export function showGenres(s: TmdbShow): string[] {
  return (s.genre_ids ?? []).map((id) => TV_GENRES_BY_ID[id]).filter(Boolean);
}

/**
 * A show's score, derived and never separately editable.
 *
 * A plain mean of the seasons somebody rated, because the binder's whole job
 * is that every number on this site can be checked by hand. A weighted average
 * would be defensible and unexplainable, and a second editable overall rating
 * would be two numbers for one thing that are allowed to disagree, which is
 * the failure this codebase has hit more than any other.
 *
 * So it is never called a rating. It is the average of the seasons, and the
 * page says so.
 */
export function derivedScore(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length);
}
