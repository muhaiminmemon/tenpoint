import { sql, type SQL } from "drizzle-orm";
import { CLUSTERS, KEYWORD_STOPLIST } from "./archetype-clusters";
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
  harshCount: number;
  distinctRatings: number;
  obscureCount: number;
  /** titles with more than one viewing logged, however they were rated */
  repeatTitleCount: number;
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
  /**
   * Rated films with 50,000 ratings or more, anywhere.
   *
   * The same line the personality profile's "Widely seen" band starts at, so
   * the trait, the archetype and the profile all cut the library in the same
   * place. They used to disagree: a card could call a library 95% mainstream
   * on one bar and mostly middling on another, both true and both unhelpful.
   *
   * Counted on IMDb rather than TMDB, for the reason given on `reach` above.
   */
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

  /**
   * The bands the personality profile is built from.
   *
   * Each set is a partition: every film that carries the field falls into
   * exactly one band, so the shares add to 100 without anything being
   * normalised into place. That is the whole point of counting them this way
   * rather than as a pile of overlapping readings.
   */
  ratingBands: [number, number, number, number];
  eraBands: [number, number, number, number];
  runtimeBands: [number, number, number, number];
  reachBands: [number, number, number, number];
  /** viewings split into first times and rewatches */
  viewingBands: [number, number];

  /** rated films whose original language is on file, and how many are not English */
  languageKnownCount: number;
  nonEnglishCount: number;
  /** how many rated films carry the genre that leads them */
  topGenreCount: number;
  /** distinct original languages across rated films */
  distinctLanguages: number;
  /** the most rated films sharing one billed cast member */
  maxCastCount: number;
  /** films released between 1950 and 1969, so the era traits do not nest */
  midCenturyCount: number;
  /**
   * Where the viewer and the critics land relative to each other. Counted only
   * over films that carry the score, which the backfill fills in.
   */
  criticsAgreeCount: number;
  againstGrainCount: number;
  /** rated films sitting 3.0 or more from the IMDb crowd, either way */
  imdbGapCount: number;
  /** the denominator for that: rated films carrying an IMDb score at all */
  imdbKnownCount: number;

  /**
   * Television, counted the same way films are.
   *
   * A season is a rated row, so none of this needed a second query: the same
   * diary, filtered by kind. What it does need is its own counters, because
   * the things worth naming about a series, finishing one, watching it fall
   * apart, are not things a film can do.
   */
  seasonCount: number;
  wholeShowCount: number;
  /**
   * Seasons of viewing this library represents, however it was recorded.
   *
   * Rating a whole series is a statement about all of its seasons, so it
   * credits all of them; rating some of them credits those. Doing both credits
   * the larger, never the sum. This is what the ladder weighs, not the row
   * count, which would price a whole-show rating at one film.
   */
  seasonsCredited: number;
  showsTouched: number;
  longestRun: number;
  completedShows: number;
  fellOffCount: number;
  grewCount: number;
  animeSeasonCount: number;
  endedSeasonCount: number;

  /**
   * How somebody rates one kind of film against another.
   *
   * Everything else here reads what a person watched, and popular films are
   * popular: two people with the same shelf come out the same. These read the
   * *opinions* instead. Rating the obscure half of your library higher than
   * the famous half is a fact about you that survives owning exactly the films
   * everybody else owns.
   *
   * Each is a mean in tenths and null when either side is too thin to compare.
   */
  meanObscure: number | null;
  meanFamous: number | null;
  meanOld: number | null;
  meanNew: number | null;
  meanEnglish: number | null;
  meanForeign: number | null;

  /** how many rated films fall into each themed cluster, and the denominator */
  clusters: Record<string, number>;
  clusterFilmCount: number;
  /** who the recurring face and the recurring director actually are */
  topCastName: string | null;
  topDirectorName: string | null;
  /**
   * How much more often those two turn up than the catalogue would produce by
   * chance.
   *
   * A raw count is worthless here: eleven films with the same lead is what
   * watching a franchise looks like, not what following an actor looks like,
   * and popular actors are popular. Measured against how much of the
   * catalogue each one is actually in, a franchise habit scores near one and
   * genuinely following somebody scores high.
   */
  topCastLift: number;
  topDirectorLift: number;
  /** average signed distance from the IMDb score, in tenths */
  imdbBias: number | null;
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
      select cur.*, f.genres, f.year, f.director, f.runtime, f.vote_count, f.original_language,
             f.cast_names, f.rt_score, f.imdb_rating, f.kind, f.show_id, f.season_number,
             -- How many people have rated it anywhere, rather than on TMDB.
             -- TMDB's audience is Western enough that its counts measure where
             -- a film was released more than how many saw it: English films
             -- here average 11,742 votes and Hindi films 787. IMDb is far from
             -- neutral but it is not fifteen times off, and when it is missing
             -- the TMDB count is scaled to the same order rather than left to
             -- make every non-Hollywood film look unseen.
             coalesce(f.imdb_votes, f.vote_count * 50) as reach
      from cur join films f on f.id = cur.film_id
    ),
    -- Television, which is the same rows filtered rather than a second query.
    seasons as (
      select show_id, season_number, rating from cur_f where kind = 'season' and show_id is not null
    ),
    per_show as (
      select s.show_id,
             count(*)::int as rated_seasons,
             min(s.rating) as worst,
             max(s.rating) as best,
             -- The first season somebody rated, which is what a fall from
             -- grace is measured against.
             (array_agg(s.rating order by s.season_number))[1] as opener,
             (array_agg(s.rating order by s.season_number desc))[1] as closer
      from seasons s group by s.show_id
    ),
    show_totals as (
      select f.show_id, count(*)::int as total_seasons
      from films f where f.kind = 'season' and f.show_id is not null group by f.show_id
    ),
    /*
     * What each series is worth, in seasons, without counting it twice.
     *
     * Rating the whole of Breaking Bad is a claim about five seasons, so it
     * credits five. Rating three of its seasons credits three. Doing both
     * credits five, not eight: the greater of the two readings, because they
     * describe the same watching rather than adding to it.
     */
    show_credit as (
      select t.show_id,
             greatest(
               coalesce(rs.rated_seasons, 0),
               case when w.whole > 0 then t.total_seasons else 0 end
             ) as seasons_credited
      from show_totals t
      left join (select show_id, count(*)::int as rated_seasons from seasons group by show_id) rs
        on rs.show_id = t.show_id
      left join (
        select show_id, count(*)::int as whole from cur_f where kind = 'show' group by show_id
      ) w on w.show_id = t.show_id
      where coalesce(rs.rated_seasons, 0) > 0 or coalesce(w.whole, 0) > 0
    ),
    genre_counts as (
      select g.value as genre, count(*)::int as count
      from cur_f cross join lateral jsonb_array_elements_text(coalesce(cur_f.genres, '[]'::jsonb)) as g(value)
      group by g.value
    ),
    /**
     * One row per work, with a series collapsed to a single entry.
     *
     * Following a face or a director means reaching for their next thing, and
     * a season is not a next thing: the creator and the top ten cast are
     * copied onto every season a series has, so thirty-eight seasons of The
     * Simpsons read as thirty-eight films by Matt Groening. That put the
     * one-director reading ten standard deviations past ordinary for somebody
     * who watched one show, and handed the same word to six of the fifteen
     * television accounts. Counting the series once says what was meant.
     */
    cur_work as (
      select * from cur_f where show_id is null
      union all
      select distinct on (show_id) * from cur_f where show_id is not null order by show_id
    ),
    cast_counts as (
      select c.value as actor, count(*)::int as count
      from cur_work cross join lateral jsonb_array_elements_text(
        case when jsonb_typeof(cur_work.cast_names) = 'array' then cur_work.cast_names else '[]'::jsonb end
      ) as c(value)
      group by c.value
    ),
    decade_counts as (
      select (year / 10) * 10 as decade, count(*)::int as count, avg(rating)::float as avg_rating
      from cur_f where year is not null group by 1
    ),
    director_counts as (
      select director, count(*)::int as count from cur_work where director is not null group by director
    ),
    -- how much of the whole catalogue each name appears in, so a count in one
    -- library can be compared against what chance would give it
    catalogue as (
      select count(*)::float as n from films
      where jsonb_typeof(cast_names) = 'array' and kind <> 'season'
    ),
    cat_cast as (
      select c.value as actor, count(*)::float as n
      from films cross join lateral jsonb_array_elements_text(
        case when jsonb_typeof(films.cast_names) = 'array' then films.cast_names else '[]'::jsonb end
      ) as c(value)
      where films.kind <> 'season'
      group by c.value
    ),
    cat_dir as (
      select director, count(*)::float as n from films
      where director is not null and kind <> 'season'
      group by director
    ),
    cast_lift as (
      -- five pseudo-films on both sides, the same shrinkage the themes use
      select (cc.count + 5) / ((select count(*) from cur_work) * (cat.n / (select n from catalogue)) + 5) as lift
      from cast_counts cc join cat_cast cat on cat.actor = cc.actor
      where cc.count >= 4
    ),
    director_lift as (
      select (dc.count + 5) / ((select count(*) from cur_work) * (cat.n / (select n from catalogue)) + 5) as lift
      from director_counts dc join cat_dir cat on cat.director = dc.director
      where dc.count >= 3
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
      (select count(*) from cur_f where reach >= 50000)::int as mainstream_count,
      (select count(*) from cur_f where reach is not null)::int as vote_known_count,
      coalesce((select sum(runtime)::int from cur_f where runtime is not null), 0) as total_runtime_minutes,
      (select count(*) from cur_f where genres is not null and jsonb_array_length(genres) > 0)::int as genre_tagged_count,

      -- rating bands: every rated film lands in exactly one
      (select count(*) from cur where rating >= 85)::int as rate_loved,
      (select count(*) from cur where rating >= 70 and rating < 85)::int as rate_liked,
      (select count(*) from cur where rating >= 55 and rating < 70)::int as rate_fair,
      (select count(*) from cur where rating < 55)::int as rate_harsh,
      -- Counts the traits read directly rather than inferring from a band.
      (select count(*) from cur where rating <= 30)::int as harsh_count,
      (select count(distinct rating) from cur)::int as distinct_ratings,
      (select count(*) from cur_f where reach < 50000)::int as obscure_count,
      (select count(*) from (
        select film_id from diary_entries
        where user_id = ${userId} and ${privacy}
        group by film_id having count(*) > 1
      ) z)::int as repeat_title_count,

      -- era bands, over films with a year on file
      (select count(*) from cur_f where year is not null and year < 1970)::int as era_classic,
      (select count(*) from cur_f where year between 1970 and 1989)::int as era_seventies,
      (select count(*) from cur_f where year between 1990 and 2009)::int as era_nineties,
      (select count(*) from cur_f where year >= 2010)::int as era_recent,

      -- runtime bands, over films with a runtime on file
      (select count(*) from cur_f where runtime is not null and runtime < 90)::int as run_short,
      (select count(*) from cur_f where runtime >= 90 and runtime < 120)::int as run_standard,
      (select count(*) from cur_f where runtime >= 120 and runtime < 150)::int as run_long,
      (select count(*) from cur_f where runtime >= 150)::int as run_epic,

      -- reach bands, over films whose vote count is on file
      (select count(*) from cur_f where reach >= 250000)::int as reach_everyone,
      (select count(*) from cur_f where reach >= 50000 and reach < 250000)::int as reach_wide,
      (select count(*) from cur_f where reach >= 5000 and reach < 50000)::int as reach_some,
      (select count(*) from cur_f where reach is not null and reach < 5000)::int as reach_few,

      -- viewings, split in two
      (select count(*) from all_entries where rewatch is not true)::int as view_first,
      (select count(*) from all_entries where rewatch = true)::int as view_again,

      (select count(*) from cur_f where original_language is not null)::int as language_known_count,
      (select count(*) from cur_f where original_language is not null and original_language <> 'en')::int as non_english_count,
      coalesce((select max(count) from genre_counts), 0)::int as top_genre_count,
      (select count(distinct original_language) from cur_f where original_language is not null)::int as distinct_languages,
      coalesce((select max(count) from cast_counts), 0)::int as max_cast_count,
      (select actor from cast_counts order by count desc, actor limit 1) as top_cast_name,
      (select director from director_counts order by count desc, director limit 1) as top_director_name,
      coalesce((select max(lift) from cast_lift), 0)::float as top_cast_lift,
      coalesce((select max(lift) from director_lift), 0)::float as top_director_lift,
      (select count(*) from cur_f where year between 1950 and 1969)::int as mid_century_count,
      (select count(*) from cur_f where rating >= 80 and rt_score >= 90)::int as critics_agree_count,
      (select count(*) from cur_f where rating >= 80 and rt_score < 50)::int as against_grain_count,
      (select count(*) from cur_f where imdb_rating is not null and abs(rating - imdb_rating) >= 30)::int as imdb_gap_count,
      (select count(*) from cur_f where imdb_rating is not null)::int as imdb_known_count,

      -- television
      (select count(*) from cur_f where kind = 'season')::int as season_count,
      (select count(*) from cur_f where kind = 'show')::int as whole_show_count,
      (select coalesce(sum(seasons_credited), 0) from show_credit)::int as seasons_credited,
      -- Every series this library has an opinion about, counted once whether
      -- that opinion is on the whole thing, on its seasons, or on both.
      (select count(*) from show_credit)::int as shows_touched,
      (select coalesce(max(rated_seasons), 0) from per_show)::int as longest_run,
      -- Every season of something, which is the only trait here that requires
      -- finishing rather than sampling.
      -- Reading show_credit, not per_show, so rating a series whole finishes
      -- it. per_show sees only per-season rows, which meant somebody who
      -- rated Breaking Bad once had five seasons credited by the line above
      -- and had completed nothing according to this one.
      (select count(*) from show_credit c join show_totals t on t.show_id = c.show_id
        where c.seasons_credited >= t.total_seasons and t.total_seasons >= 2)::int as completed_shows,
      -- A show that lost you: an opener rated well and a later season three
      -- points below it.
      (select count(*) from per_show where rated_seasons >= 2 and opener - closer >= 30)::int as fell_off_count,
      -- And the opposite, which is rarer and worth its own name.
      (select count(*) from per_show where rated_seasons >= 2 and closer - opener >= 30)::int as grew_count,
      (select count(*) from cur_f c join shows sh on sh.id = c.show_id
        where c.kind = 'season' and sh.form = 'anime')::int as anime_season_count,
      (select count(*) from cur_f c join shows sh on sh.id = c.show_id
        where c.kind = 'season' and sh.status = 'Ended')::int as ended_season_count,

      -- opinion axes: each side needs 10 films or the comparison is noise
      (select case when count(*) >= 10 then avg(rating) end from cur_f where reach < 50000) as mean_obscure,
      (select case when count(*) >= 10 then avg(rating) end from cur_f where reach >= 50000) as mean_famous,
      (select case when count(*) >= 10 then avg(rating) end from cur_f where year is not null and year < 1990) as mean_old,
      (select case when count(*) >= 10 then avg(rating) end from cur_f where year is not null and year >= 1990) as mean_new,
      (select case when count(*) >= 10 then avg(rating) end from cur_f where original_language = 'en') as mean_english,
      (select case when count(*) >= 10 then avg(rating) end from cur_f where original_language is not null and original_language <> 'en') as mean_foreign,
      (select case when count(*) >= 15 then avg(rating - imdb_rating) end from cur_f where imdb_rating is not null) as imdb_bias
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
    ratingBands: band(r, "rate_loved", "rate_liked", "rate_fair", "rate_harsh"),
    harshCount: num(r, "harsh_count"),
    distinctRatings: num(r, "distinct_ratings"),
    obscureCount: num(r, "obscure_count"),
    repeatTitleCount: num(r, "repeat_title_count"),
    eraBands: band(r, "era_classic", "era_seventies", "era_nineties", "era_recent"),
    runtimeBands: band(r, "run_short", "run_standard", "run_long", "run_epic"),
    reachBands: band(r, "reach_everyone", "reach_wide", "reach_some", "reach_few"),
    viewingBands: [num(r, "view_first"), num(r, "view_again")],
    languageKnownCount: num(r, "language_known_count"),
    nonEnglishCount: num(r, "non_english_count"),
    topGenreCount: num(r, "top_genre_count"),
    distinctLanguages: num(r, "distinct_languages"),
    maxCastCount: num(r, "max_cast_count"),
    midCenturyCount: num(r, "mid_century_count"),
    criticsAgreeCount: num(r, "critics_agree_count"),
    againstGrainCount: num(r, "against_grain_count"),
    imdbGapCount: num(r, "imdb_gap_count"),
    imdbKnownCount: num(r, "imdb_known_count"),
    seasonCount: num(r, "season_count"),
    wholeShowCount: num(r, "whole_show_count"),
    seasonsCredited: num(r, "seasons_credited"),
    showsTouched: num(r, "shows_touched"),
    longestRun: num(r, "longest_run"),
    completedShows: num(r, "completed_shows"),
    fellOffCount: num(r, "fell_off_count"),
    grewCount: num(r, "grew_count"),
    animeSeasonCount: num(r, "anime_season_count"),
    endedSeasonCount: num(r, "ended_season_count"),
    meanObscure: maybe(r, "mean_obscure"),
    meanFamous: maybe(r, "mean_famous"),
    meanOld: maybe(r, "mean_old"),
    meanNew: maybe(r, "mean_new"),
    meanEnglish: maybe(r, "mean_english"),
    meanForeign: maybe(r, "mean_foreign"),
    imdbBias: maybe(r, "imdb_bias"),
    topCastName: (r.top_cast_name as string) ?? null,
    topDirectorName: (r.top_director_name as string) ?? null,
    topCastLift: (r.top_cast_lift as number) ?? 0,
    topDirectorLift: (r.top_director_lift as number) ?? 0,
    ...(await clusterCounts(userId, privacy)),
  };
}

/**
 * Which themed clusters a library falls into, counted once per film.
 *
 * Done in a second pass rather than the big query because the keyword-to-theme
 * map lives in code, not in the database: a film carrying three keywords from
 * one cluster is one film in that cluster, and expressing that in SQL would
 * mean shipping four hundred mappings into the statement.
 */
async function clusterCounts(
  userId: string,
  privacy: SQL,
): Promise<{ clusters: Record<string, number>; clusterFilmCount: number }> {
  const rows = await db.execute(sql`
    with cur as (
      select distinct on (d.film_id) d.film_id
      from diary_entries d
      where d.user_id = ${userId} and d.rating is not null and ${privacy}
      order by d.film_id, d.watched_on desc nulls last, d.created_at desc
    )
    select cur.film_id, f.keywords
    from cur join films f on f.id = cur.film_id
    where jsonb_typeof(f.keywords) = 'array' and jsonb_array_length(f.keywords) > 0
  `);

  const counts: Record<string, number> = {};
  let films = 0;
  for (const row of rows as unknown as Record<string, unknown>[]) {
    films++;
    const held = new Set(
      (row.keywords as string[]).map((k) => k.toLowerCase()).filter((k) => !KEYWORD_STOPLIST.has(k)),
    );
    for (const c of CLUSTERS) {
      if (c.keywords.some((k) => held.has(k))) counts[c.key] = (counts[c.key] ?? 0) + 1;
    }
  }
  return { clusters: counts, clusterFilmCount: films };
}

const num = (r: Record<string, unknown>, key: string) => (r[key] as number) ?? 0;

/** A figure that is genuinely absent when there was too little to compute it. */
const maybe = (r: Record<string, unknown>, key: string) =>
  r[key] === null || r[key] === undefined ? null : Number(r[key]);

const band = (
  r: Record<string, unknown>,
  a: string,
  b: string,
  c: string,
  d: string,
): [number, number, number, number] => [num(r, a), num(r, b), num(r, c), num(r, d)];
