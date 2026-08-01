import { sql } from "drizzle-orm";
import { db } from "@/db";

/** The raw counts every trait, milestone and variant axis is read off. */
export type TasteSignals = {
  rated: number;
  mean: number | null;
  ratingStdDev: number | null;
  distinctGenres: number;
  distinctDecades: number;
  /**
   * Rated films sitting within 1.0 of the user's own average. A real
   * proportion of a real denominator, unlike a rescaled standard deviation,
   * so "how consistent am I" can be checked against the library by hand.
   */
  nearMeanCount: number;
  /** rated films reaching 7.0 */
  positiveCount: number;
  /** rated films whose rating is not a round point, i.e. actually uses the tenths */
  decimalRatingCount: number;
  /** every diary entry, rated or not — the denominator for anything about viewings */
  totalEntryCount: number;
  /** rated films released in 2010 or later */
  modernCount: number;
  /**
   * The denominators for readings that need TMDB metadata. Hydration is lazy,
   * so each reading divides by the films that actually have the field on file
   * and is withheld when too few do. Dividing by every rated film would report
   * "not known yet" as "not true of you".
   */
  yearKnownCount: number;
  runtimeKnownCount: number;
  directorKnownCount: number;
  /** rated films by a director the user has rated three or more times */
  loyalDirectorFilmCount: number;
  preFiftyCount: number;
  preSeventyCount: number;
  currentYearReleaseCount: number;
  maxDirectorCount: number;
  longFilmCount: number;
  shortFilmCount: number;
  maxSameFilmEntries: number;
  rewatchEntryCount: number;
  reviewCount: number;
  perfectTenCount: number;
  toughCriticCount: number;
  sameYearWatchCount: number;
  topRatedDecade: number | null;
  /** among rated films with a runtime on file */
  avgRuntime: number | null;
  /** rated films with 1000+ TMDB votes — the "everyone's seen it" bar */
  mainstreamCount: number;
  /**
   * Rated films that have a vote count on file at all — the real denominator
   * for the mainstream split. Metadata is hydrated lazily, so a large library
   * can be mostly unknown, and dividing by every rated film would report
   * "unknown" as "indie".
   */
  voteKnownCount: number;
  /** sum of runtime minutes across rated films with a runtime on file */
  totalRuntimeMinutes: number;
  /** rated films that have at least one genre tag on file — the real denominator for genre share */
  genreTaggedCount: number;
  /** rated films also marked a favourite — a deliberate-curation signal, not a time-in-app one */
  favouriteCount: number;
};

/**
 * Every number a trait, milestone or variant axis is computed from, for one
 * user, in a single round trip. `cur` mirrors `getTasteProfile`'s "current
 * rating per film" semantics; `all_entries` covers rewatch/review/diary
 * signals that aren't about the current rating at all.
 */
export async function getTasteSignals(
  userId: string,
  { includePrivate = false }: { includePrivate?: boolean } = {},
): Promise<TasteSignals> {
  const privacy = includePrivate ? sql`true` : sql`private = false`;

  const rows = await db.execute(sql`
    with cur as (
      select distinct on (d.film_id) d.film_id, d.rating, d.watched_on
      from diary_entries d
      where d.user_id = ${userId} and d.rating is not null and ${privacy}
      order by d.film_id, d.watched_on desc nulls last, d.created_at desc
    ),
    cur_f as (
      select cur.*, f.genres, f.year, f.director, f.runtime, f.vote_count
      from cur join films f on f.id = cur.film_id
    ),
    genre_counts as (
      select g.value as genre, count(*)::int as count
      from cur_f cross join lateral jsonb_array_elements_text(coalesce(cur_f.genres, '[]'::jsonb)) as g(value)
      group by g.value
    ),
    decade_counts as (
      select (year / 10) * 10 as decade, count(*)::int as count, avg(rating)::float as avg_rating
      from cur_f where year is not null group by 1
    ),
    director_counts as (
      select director, count(*)::int as count from cur_f where director is not null group by director
    ),
    all_entries as (
      select d.*, f.year as film_year
      from diary_entries d join films f on f.id = d.film_id
      where d.user_id = ${userId} and ${privacy}
    ),
    same_film as (
      select film_id, count(*)::int as count from all_entries group by film_id
    )
    select
      (select count(*) from cur)::int as rated,
      (select avg(rating)::float from cur) as mean,
      (select stddev_pop(rating)::float from cur) as rating_std_dev,
      (select count(*) from genre_counts)::int as distinct_genres,
      (select count(*) from decade_counts)::int as distinct_decades,
      (select count(*) from cur where abs(rating - (select avg(rating) from cur)) <= 10)::int as near_mean_count,
      (select count(*) from cur where rating >= 70)::int as positive_count,
      (select count(*) from cur where rating % 10 <> 0)::int as decimal_rating_count,
      (select count(*) from all_entries)::int as total_entry_count,
      (select count(*) from cur_f where year is not null and year >= 2010)::int as modern_count,
      (select count(*) from cur_f where year is not null)::int as year_known_count,
      (select count(*) from cur_f where runtime is not null)::int as runtime_known_count,
      (select count(*) from cur_f where director is not null)::int as director_known_count,
      (select coalesce(sum(count), 0) from director_counts where count >= 3)::int as loyal_director_film_count,
      (select count(*) from cur_f where year is not null and year < 1950)::int as pre_fifty_count,
      (select count(*) from cur_f where year is not null and year < 1970)::int as pre_seventy_count,
      (select count(*) from cur_f where year = extract(year from now())::int)::int as current_year_release_count,
      coalesce((select max(count) from director_counts), 0)::int as max_director_count,
      (select count(*) from cur_f where runtime is not null and runtime >= 150)::int as long_film_count,
      (select count(*) from cur_f where runtime is not null and runtime <= 85)::int as short_film_count,
      coalesce((select max(count) from same_film), 0)::int as max_same_film_entries,
      (select count(*) from all_entries where rewatch = true)::int as rewatch_entry_count,
      (select count(*) from all_entries where review is not null and length(trim(review)) > 0)::int as review_count,
      (select count(*) from cur where rating = 100)::int as perfect_ten_count,
      (select count(*) from cur where rating <= 30)::int as tough_critic_count,
      (select count(*) from all_entries where watched_on is not null and film_year is not null and extract(year from watched_on)::int = film_year)::int as same_year_watch_count,
      (select decade from decade_counts where count >= 3 order by avg_rating desc limit 1) as top_rated_decade,
      (select avg(runtime)::float from cur_f where runtime is not null) as avg_runtime,
      (select count(*) from cur_f where vote_count is not null and vote_count >= 1000)::int as mainstream_count,
      (select count(*) from cur_f where vote_count is not null)::int as vote_known_count,
      coalesce((select sum(runtime)::int from cur_f where runtime is not null), 0) as total_runtime_minutes,
      (select count(*) from cur_f where genres is not null and jsonb_array_length(genres) > 0)::int as genre_tagged_count,
      (select count(*) from cur_f cf join favourites fav on fav.film_id = cf.film_id and fav.user_id = ${userId})::int as favourite_count
  `);

  const r = (rows as unknown as Record<string, unknown>[])[0];
  return {
    rated: (r.rated as number) ?? 0,
    mean: r.mean === null ? null : Math.round(r.mean as number),
    ratingStdDev: r.rating_std_dev === null ? null : (r.rating_std_dev as number),
    distinctGenres: (r.distinct_genres as number) ?? 0,
    distinctDecades: (r.distinct_decades as number) ?? 0,
    nearMeanCount: (r.near_mean_count as number) ?? 0,
    positiveCount: (r.positive_count as number) ?? 0,
    decimalRatingCount: (r.decimal_rating_count as number) ?? 0,
    totalEntryCount: (r.total_entry_count as number) ?? 0,
    modernCount: (r.modern_count as number) ?? 0,
    yearKnownCount: (r.year_known_count as number) ?? 0,
    runtimeKnownCount: (r.runtime_known_count as number) ?? 0,
    directorKnownCount: (r.director_known_count as number) ?? 0,
    loyalDirectorFilmCount: (r.loyal_director_film_count as number) ?? 0,
    preFiftyCount: (r.pre_fifty_count as number) ?? 0,
    preSeventyCount: (r.pre_seventy_count as number) ?? 0,
    currentYearReleaseCount: (r.current_year_release_count as number) ?? 0,
    maxDirectorCount: (r.max_director_count as number) ?? 0,
    longFilmCount: (r.long_film_count as number) ?? 0,
    shortFilmCount: (r.short_film_count as number) ?? 0,
    maxSameFilmEntries: (r.max_same_film_entries as number) ?? 0,
    rewatchEntryCount: (r.rewatch_entry_count as number) ?? 0,
    reviewCount: (r.review_count as number) ?? 0,
    perfectTenCount: (r.perfect_ten_count as number) ?? 0,
    toughCriticCount: (r.tough_critic_count as number) ?? 0,
    sameYearWatchCount: (r.same_year_watch_count as number) ?? 0,
    topRatedDecade: r.top_rated_decade === null ? null : (r.top_rated_decade as number),
    avgRuntime: r.avg_runtime === null ? null : (r.avg_runtime as number),
    mainstreamCount: (r.mainstream_count as number) ?? 0,
    voteKnownCount: (r.vote_known_count as number) ?? 0,
    totalRuntimeMinutes: (r.total_runtime_minutes as number) ?? 0,
    genreTaggedCount: (r.genre_tagged_count as number) ?? 0,
    favouriteCount: (r.favourite_count as number) ?? 0,
  };
}
