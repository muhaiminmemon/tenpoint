import { sql } from "drizzle-orm";
import { db } from "@/db";

export type LibraryFilm = {
  filmId: string;
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  director: string | null;
  /** billed leads, for searching the library by who is in a film */
  cast: string[];
  /** tenths, from the most recent *rated* entry; null = watched, never rated */
  rating: number | null;
  entryCount: number;
  lastWatched: string | null;
  sortKey: number;
  /** a separate signal from the rating: one you'd put on again tonight */
  favourite: boolean;
  /** true when any viewing of it was logged as a rewatch */
  rewatched: boolean;
};

/**
 * Ranked library. A film's current rating comes from its most recent rated
 * entry, so an unrated later viewing never erases the last actual rating.
 * Equal ratings keep the user's manual order (sort_key), then title.
 */
export async function getRankedLibrary(
  userId: string,
  { includePrivate = true }: { includePrivate?: boolean } = {},
): Promise<LibraryFilm[]> {
  const privacyFilter = includePrivate ? sql`true` : sql`private = false`;
  const rows = await db.execute(sql`
    with rated as (
      select distinct on (film_id)
        film_id, rating
      from diary_entries
      where user_id = ${userId} and rating is not null and ${privacyFilter}
      order by film_id, watched_on desc nulls last, created_at desc
    ),
    stats as (
      select
        film_id,
        count(*)::int as entry_count,
        max(watched_on) as last_watched,
        bool_or(rewatch) as rewatched
      from diary_entries
      where user_id = ${userId} and ${privacyFilter}
      group by film_id
    )
    select
      f.id as film_id,
      f.slug,
      f.title,
      f.year,
      f.poster_path,
      f.director,
      f.cast_names,
      r.rating,
      s.entry_count,
      s.last_watched,
      s.rewatched,
      (fav.film_id is not null) as favourite,
      coalesce(o.sort_key, 0) as sort_key
    from stats s
    join films f on f.id = s.film_id
    left join rated r on r.film_id = s.film_id
    left join favourites fav on fav.user_id = ${userId} and fav.film_id = s.film_id
    left join library_order o on o.user_id = ${userId} and o.film_id = s.film_id
    order by r.rating desc nulls last, coalesce(o.sort_key, 0) asc, f.title asc
  `);

  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    filmId: r.film_id as string,
    slug: r.slug as string,
    title: r.title as string,
    year: r.year as number | null,
    posterPath: r.poster_path as string | null,
    director: r.director as string | null,
    // The full billed list, not a trim of it. Cutting to the leads would make
    // a supporting name silently return nothing, which reads as a broken
    // filter; measured on a 246-film library the tail costs 16KB before
    // compression, and repeated names compress well.
    cast: Array.isArray(r.cast_names) ? (r.cast_names as string[]) : [],
    rating: r.rating as number | null,
    entryCount: r.entry_count as number,
    lastWatched: r.last_watched as string | null,
    sortKey: r.sort_key as number,
    favourite: Boolean(r.favourite),
    rewatched: Boolean(r.rewatched),
  }));
}

export { formatTenths } from "./format";

export type RecentViewing = {
  entryId: string;
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** tenths as logged on this viewing; null = watched, not rated */
  rating: number | null;
  watchedOn: string | null;
  rewatch: boolean;
  hasReview: boolean;
  /** how many times this film appears in the diary, this viewing included */
  entryCount: number;
};

/**
 * The last few viewings, newest first.
 *
 * One row per *viewing*, not per film, which is the point: a rewatch is its
 * own line here even though the library collapses it. The rating shown is the
 * one logged on that viewing rather than the film's current rating, so a row
 * reads as what was actually written down at the time.
 *
 * Undated entries sort last within their created order rather than being
 * dropped: a bulk import often has no watch dates at all, and a "recent"
 * panel that renders empty for those libraries would be wrong about a record
 * that is entirely present.
 */
export async function getRecentViewings(
  userId: string,
  limit = 6,
): Promise<RecentViewing[]> {
  const rows = await db.execute(sql`
    select
      d.id as entry_id,
      f.slug, f.title, f.year, f.poster_path,
      d.rating, d.watched_on, d.rewatch,
      (d.review is not null and length(trim(d.review)) > 0) as has_review,
      (select count(*) from diary_entries e
        where e.user_id = d.user_id and e.film_id = d.film_id)::int as entry_count
    from diary_entries d
    join films f on f.id = d.film_id
    where d.user_id = ${userId}
    order by d.watched_on desc nulls last, d.created_at desc
    limit ${limit}
  `);

  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    entryId: r.entry_id as string,
    slug: r.slug as string,
    title: r.title as string,
    year: r.year as number | null,
    posterPath: r.poster_path as string | null,
    rating: r.rating as number | null,
    watchedOn: r.watched_on === null ? null : String(r.watched_on).slice(0, 10),
    rewatch: r.rewatch as boolean,
    hasReview: r.has_review as boolean,
    entryCount: r.entry_count as number,
  }));
}
