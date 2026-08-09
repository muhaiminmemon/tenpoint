import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getSeriesProgress, type SeriesState } from "./series-progress";

/** One season inside a collapsed series row, as the shelf's panel lists it. */
export type LibrarySeason = {
  filmId: string;
  slug: string;
  /** "Season 4", with the series name already taken off the front */
  label: string;
  seasonNumber: number;
  year: number | null;
  episodes: number | null;
  posterPath: string | null;
  /** the crowd's average for this season, in tenths */
  audience: number | null;
  /** their current rating of it, in tenths; null = never rated */
  rating: number | null;
  /** the entry behind that rating, so the panel can undo it */
  entryId: string | null;
  unaired: boolean;
};

/**
 * A series as one thing on the shelf, with its seasons carried inside it.
 *
 * The seasons travel with the row rather than being fetched when the panel
 * opens. The whole set for a heavy television library is a few tens of
 * kilobytes of short fields, and shipping it means the panel has no loading
 * state, no second permission check, and no way to disagree with the row that
 * opened it.
 */
export type LibrarySeries = {
  showId: string;
  slug: string;
  name: string;
  totalSeasons: number;
  ratedSeasons: number;
  ratedWhole: boolean;
  credited: number;
  state: SeriesState;
  nextSeason: number | null;
  ended: boolean;
  /** the rating they put on the series as a whole, when they put one */
  wholeRating: number | null;
  /** their mean across the seasons they rated individually */
  meanRating: number | null;
  seasons: LibrarySeason[];
};

export type LibraryFilm = {
  /**
   * What this row stands for.
   *
   * "series" is a collapsed row and the only kind that carries `series`.
   * "season" and "show" appear only when the caller asked not to collapse,
   * which is the taste card and the list picker: the card counts seasons as
   * seasons, and a list of the best seasons of television is a real thing to
   * want to make.
   */
  kind: "movie" | "season" | "show" | "series";
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
  /** true when any viewing of it was logged as a rewatch */
  rewatched: boolean;
  /** present on, and only on, a collapsed series row */
  series?: LibrarySeries;
};

type Row = LibraryFilm & { showId: string | null; seasonNumber: number | null };

/** The order the SQL puts rows in, reapplied after series have been folded in. */
function byRank(a: LibraryFilm, b: LibraryFilm): number {
  if (a.rating === null && b.rating !== null) return 1;
  if (b.rating === null && a.rating !== null) return -1;
  if (a.rating !== null && b.rating !== null && a.rating !== b.rating) {
    return b.rating - a.rating;
  }
  return a.sortKey - b.sortKey || a.title.localeCompare(b.title);
}

/**
 * Ranked library. A film's current rating comes from its most recent rated
 * entry, so an unrated later viewing never erases the last actual rating.
 * Equal ratings keep the user's manual order (sort_key), then title.
 *
 * Television arrives as one row per series, not one per season. A library is a
 * list of works, and a person who follows a show season by season was getting
 * thirty-eight rows of The Simpsons sorted among their films as if each were
 * one. `collapseSeries: false` is for the two readers that genuinely want the
 * underlying rows.
 */
export async function getRankedLibrary(
  userId: string,
  {
    includePrivate = true,
    collapseSeries = true,
  }: { includePrivate?: boolean; collapseSeries?: boolean } = {},
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
      f.kind,
      f.show_id,
      f.season_number,
      f.year,
      f.poster_path,
      f.director,
      f.cast_names,
      r.rating,
      s.entry_count,
      s.last_watched,
      s.rewatched,
      coalesce(o.sort_key, 0) as sort_key
    from stats s
    join films f on f.id = s.film_id
    left join rated r on r.film_id = s.film_id
    left join library_order o on o.user_id = ${userId} and o.film_id = s.film_id
    order by r.rating desc nulls last, coalesce(o.sort_key, 0) asc, f.title asc
  `);

  const all: Row[] = (rows as unknown as Record<string, unknown>[]).map((r) => {
    const kind = r.kind as string;
    return {
      filmId: r.film_id as string,
      slug: r.slug as string,
      title: r.title as string,
      // Not a two-way split any more. Folding "show" into "movie" is what put
      // a whole-series rating in somebody's film count: rating Breaking Bad
      // 9.2 made it a film, and the Films chip counted it as one.
      kind: kind === "season" || kind === "show" ? kind : ("movie" as const),
      showId: (r.show_id as string) ?? null,
      seasonNumber: r.season_number === null ? null : Number(r.season_number),
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
      rewatched: Boolean(r.rewatched),
    };
  });

  if (!collapseSeries) return all.map(strip);

  const television = all.filter((r) => r.showId !== null);
  if (television.length === 0) return all.map(strip);

  const films = all.filter((r) => r.showId === null);
  const collapsed = await foldSeries(userId, television, includePrivate);
  return [...films.map(strip), ...collapsed].sort(byRank);
}

/** Drop the grouping columns the caller has no use for. */
function strip({ showId: _s, seasonNumber: _n, ...film }: Row): LibraryFilm {
  return film;
}

/**
 * Every season of the series a library has touched, with what they made of it.
 *
 * Unrated seasons are included on purpose: the panel this feeds exists as much
 * to carry on with a series as to look back at it, and a list that stopped at
 * season four would be a list of what you have already done.
 */
async function seasonsOf(
  userId: string,
  showIds: string[],
  includePrivate: boolean,
): Promise<Map<string, LibrarySeason[]>> {
  const privacy = includePrivate ? sql`true` : sql`d.private = false`;
  const rows = await db.execute(sql`
    with mine as (
      select distinct on (d.film_id) d.film_id, d.rating, d.id as entry_id
      from diary_entries d
      where d.user_id = ${userId} and d.rating is not null and ${privacy}
      order by d.film_id, d.watched_on desc nulls last, d.created_at desc
    )
    select f.id, f.slug, f.title, f.show_id, f.season_number, f.episode_count,
           f.year, f.poster_path, f.audience_rating, f.release_date,
           sh.name as show_name,
           m.rating, m.entry_id
    from films f
    join shows sh on sh.id = f.show_id
    left join mine m on m.film_id = f.id
    where f.kind = 'season'
      and f.show_id in (${sql.join(showIds.map((id) => sql`${id}::uuid`), sql`, `)})
    order by f.show_id, f.season_number nulls last
  `);

  const today = new Date().toISOString().slice(0, 10);
  const out = new Map<string, LibrarySeason[]>();
  for (const r of rows as unknown as Record<string, unknown>[]) {
    const showId = String(r.show_id);
    const name = String(r.show_name);
    const title = String(r.title);
    const list = out.get(showId) ?? [];
    list.push({
      filmId: String(r.id),
      slug: String(r.slug),
      // The rows are stored as "Breaking Bad: Season 4"; inside a panel headed
      // by the series, repeating the name in every line is noise.
      label: title.startsWith(`${name}: `) ? title.slice(name.length + 2) : title,
      seasonNumber: r.season_number === null ? 0 : Number(r.season_number),
      year: r.year === null ? null : Number(r.year),
      episodes: r.episode_count === null ? null : Number(r.episode_count),
      posterPath: (r.poster_path as string) ?? null,
      audience: r.audience_rating === null ? null : Number(r.audience_rating),
      rating: r.rating === null ? null : Number(r.rating),
      entryId: (r.entry_id as string) ?? null,
      unaired: r.release_date !== null && String(r.release_date).slice(0, 10) > today,
    });
    out.set(showId, list);
  }
  return out;
}

/**
 * One row per series, out of the season and whole-series rows behind it.
 *
 * The rating shown is the one they gave the series as a whole when they gave
 * one, and the mean of the seasons they rated otherwise. That order matters:
 * a whole-series rating is an opinion somebody actually typed, and deriving an
 * average over it would replace their verdict with arithmetic.
 */
async function foldSeries(
  userId: string,
  television: Row[],
  includePrivate: boolean,
): Promise<LibraryFilm[]> {
  const byShow = new Map<string, Row[]>();
  for (const r of television) {
    const list = byShow.get(r.showId!) ?? [];
    list.push(r);
    byShow.set(r.showId!, list);
  }
  const showIds = [...byShow.keys()];

  const [progress, seasons] = await Promise.all([
    getSeriesProgress(userId, { includePrivate }),
    seasonsOf(userId, showIds, includePrivate),
  ]);
  const standing = new Map(progress.map((p) => [p.showId, p]));

  const out: LibraryFilm[] = [];
  for (const [showId, rows] of byShow) {
    const seasonList = seasons.get(showId) ?? [];
    const p = standing.get(showId);

    /**
     * A series can be in the library and absent from the progress query, which
     * only knows about rated rows: logging a season without rating it puts it
     * on the shelf and nowhere else. Such a row still has to appear, so the
     * few facts progress would have supplied are read straight off the seasons.
     */
    const whole = rows.find((r) => r.kind === "show");
    const name = p?.name ?? whole?.title ?? seasonList[0]?.label ?? "Untitled series";
    const rated = rows.filter((r) => r.rating !== null);

    // What the row is filed under for ordering and reordering. The whole-series
    // row when there is one, so a manual position survives rating a new season;
    // otherwise the earliest season they have an opinion about, which does not
    // move when a rating changes the way "highest rated" would.
    const pool = rated.length > 0 ? rated : rows;
    const representative =
      whole ??
      [...pool].sort((a, b) => (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0))[0];

    const series: LibrarySeries = {
      showId,
      slug: p?.slug ?? whole?.slug ?? representative.slug,
      name,
      totalSeasons: p?.totalSeasons ?? seasonList.length,
      ratedSeasons: p?.ratedSeasons ?? 0,
      ratedWhole: p?.ratedWhole ?? false,
      credited: p?.credited ?? 0,
      state: p?.state ?? "unfinished",
      nextSeason:
        p?.nextSeason ?? seasonList.find((s) => s.rating === null)?.seasonNumber ?? null,
      ended: p?.ended ?? false,
      wholeRating: p?.wholeRating ?? null,
      meanRating: p?.meanRating ?? null,
      seasons: seasonList,
    };

    const cast = [...new Set(rows.flatMap((r) => r.cast))].slice(0, 40);

    out.push({
      kind: "series",
      filmId: representative.filmId,
      slug: series.slug,
      title: name,
      year: p?.firstAirYear ?? whole?.year ?? null,
      posterPath: p?.posterPath ?? whole?.posterPath ?? seasonList[0]?.posterPath ?? null,
      // A series has creators rather than a director, and the row has a truer
      // line to print in that slot: how far through it they are.
      director: null,
      cast,
      rating: series.wholeRating ?? series.meanRating,
      entryCount: rows.reduce((n, r) => n + r.entryCount, 0),
      lastWatched: rows.reduce<string | null>(
        (latest, r) => (r.lastWatched && (!latest || r.lastWatched > latest) ? r.lastWatched : latest),
        null,
      ),
      sortKey: representative.sortKey,
      rewatched: rows.some((r) => r.rewatched),
      series,
    });
  }
  return out;
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
