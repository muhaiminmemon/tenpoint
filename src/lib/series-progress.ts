import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Where somebody stands on each series they have an opinion about.
 *
 * The library lists one row per rated title, which for television means one
 * row per season: a viewer of The Simpsons occupies thirty-eight rows and
 * still cannot see whether they finished it. That is the wrong grain for the
 * only question television actually poses, which is what am I part-way
 * through, so this answers at the level of the series.
 */

/**
 * Three states, because "completed" was quietly two.
 *
 * Finishing something that has ended is permanent. Finishing something still
 * airing is provisional and will lapse the moment a new season lands, through
 * no act of the viewer's. Collapsing those into one label is what made the
 * number feel wrong: a card said complete, a season aired, and the card
 * changed its mind about something the reader had already done.
 */
export type SeriesState = "finished" | "caughtup" | "unfinished";

export type SeriesProgress = {
  showId: string;
  slug: string;
  name: string;
  posterPath: string | null;
  firstAirYear: number | null;
  /** seasons of it we hold, which for a running series is what has aired */
  totalSeasons: number;
  /** seasons of it they have rated individually */
  ratedSeasons: number;
  /** they rated the series as a whole, which is a claim about all of it */
  ratedWhole: boolean;
  /** seasons credited to them, the greater of the two readings, never the sum */
  credited: number;
  state: SeriesState;
  /** their mean across the seasons they rated, in tenths; null if only the whole */
  meanRating: number | null;
  /** the rating on the whole-series row, when there is one */
  wholeRating: number | null;
  /** the lowest-numbered season they have not rated, for "carry on from here" */
  nextSeason: number | null;
  lastWatched: string | null;
  ended: boolean;
};

/**
 * Every series this library has touched, with where it stands.
 *
 * One query rather than one per series: a library with sixty series would
 * otherwise be sixty round trips to render a single shelf.
 */
export async function getSeriesProgress(
  userId: string,
  { includePrivate = false }: { includePrivate?: boolean } = {},
): Promise<SeriesProgress[]> {
  const privacy = includePrivate ? sql`true` : sql`d.private = false`;

  const rows = await db.execute(sql`
    with cur as (
      -- the current opinion per title, the same way the rest of the app reads it
      select distinct on (d.film_id) d.film_id, d.rating, d.watched_on
      from diary_entries d
      where d.user_id = ${userId} and d.rating is not null and ${privacy}
      order by d.film_id, d.watched_on desc nulls last, d.created_at desc
    ),
    mine as (
      select f.show_id, f.kind, f.season_number, c.rating, c.watched_on
      from cur c join films f on f.id = c.film_id
      where f.show_id is not null
    ),
    totals as (
      select show_id, count(*)::int as total
      from films where kind = 'season' and show_id is not null
      group by show_id
    ),
    agg as (
      select m.show_id,
             count(*) filter (where m.kind = 'season')::int as rated_seasons,
             count(*) filter (where m.kind = 'show')::int as whole_rows,
             avg(m.rating) filter (where m.kind = 'season')::float as mean_rating,
             max(m.rating) filter (where m.kind = 'show')::int as whole_rating,
             max(m.watched_on)::text as last_watched
      from mine m group by m.show_id
    )
    select sh.id as show_id, sh.slug, sh.name, sh.poster_path, sh.first_air_year,
           sh.status,
           coalesce(t.total, 0)::int as total_seasons,
           a.rated_seasons, a.whole_rows, a.mean_rating, a.whole_rating, a.last_watched,
           (
             -- the lowest season they have no rating for, so a row can say
             -- where to pick it up rather than only that it is unfinished
             select min(f2.season_number)
             from films f2
             where f2.show_id = sh.id and f2.kind = 'season'
               and not exists (
                 select 1 from mine m2
                 where m2.show_id = sh.id and m2.kind = 'season'
                   and m2.season_number = f2.season_number
               )
           )::int as next_season
    from agg a
    join shows sh on sh.id = a.show_id
    left join totals t on t.show_id = a.show_id
  `);

  const out = (rows as unknown as Record<string, unknown>[]).map((r) => {
    const total = Number(r.total_seasons) || 0;
    const ratedSeasons = Number(r.rated_seasons) || 0;
    const ratedWhole = Number(r.whole_rows) > 0;
    // Cancelled counts as ended. A show cut short is no less over than one
    // that finished on its own terms, and telling somebody they are merely
    // "caught up" on Deadwood, off the air since 2006, is just wrong.
    const ended = ["Ended", "Canceled", "Cancelled"].includes(String(r.status ?? ""));

    /**
     * Rating the whole thing finishes it.
     *
     * The same claim `seasonsCredited` already accepts on the card: saying
     * Breaking Bad is a 9.4 is a statement about five seasons, not about
     * none. Counting it otherwise would have told somebody who used the
     * feature built to save them rating six seasons one by one that they had
     * finished nothing.
     */
    const complete = ratedWhole || (total > 0 && ratedSeasons >= total);
    const state: SeriesState = !complete ? "unfinished" : ended ? "finished" : "caughtup";

    return {
      showId: String(r.show_id),
      slug: String(r.slug),
      name: String(r.name),
      posterPath: (r.poster_path as string) ?? null,
      firstAirYear: r.first_air_year === null ? null : Number(r.first_air_year),
      totalSeasons: total,
      ratedSeasons,
      ratedWhole,
      credited: Math.max(ratedSeasons, ratedWhole ? total : 0),
      state,
      meanRating: r.mean_rating === null ? null : Math.round(Number(r.mean_rating)),
      wholeRating: r.whole_rating === null ? null : Number(r.whole_rating),
      // Nothing to carry on with once it is complete. Rating the whole series
      // leaves every season individually unrated, so this would otherwise
      // point a finished viewer at season two.
      nextSeason: complete || r.next_season === null ? null : Number(r.next_season),
      lastWatched: (r.last_watched as string) ?? null,
      ended,
    } satisfies SeriesProgress;
  });

  // Unfinished first, because the shelf exists to answer what to carry on
  // with; within that, whatever was watched most recently.
  const rank: Record<SeriesState, number> = { unfinished: 0, caughtup: 1, finished: 2 };
  return out.sort(
    (a, b) =>
      rank[a.state] - rank[b.state] || (b.lastWatched ?? "").localeCompare(a.lastWatched ?? ""),
  );
}
