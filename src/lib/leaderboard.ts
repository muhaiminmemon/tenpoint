import { sql } from "drizzle-orm";
import { db } from "@/db";

export type TopRatedFilm = {
  slug: string;
  title: string;
  year: number | null;
  director: string | null;
  posterPath: string | null;
  /** community mean in tenths */
  mean: number;
  /** how many people's ratings that mean is built from */
  voters: number;
  /** which route the slug belongs to; a series is not at /film */
  kind: "movie" | "show";
};

/**
 * The highest-rated films across everyone here, weighted by how many people
 * actually rated them.
 *
 * This used to order by the raw mean and break ties on voter count, which
 * sounds like the same thing and is not: two means are almost never exactly
 * equal, so the tiebreak never fired and one person's 10.0 outranked a film
 * nine people loved. Two thirds of the catalogue is rated by exactly one
 * person, so the board was almost entirely single votes.
 *
 * The fix is the shrinkage this codebase uses everywhere else. Each film's
 * mean is pulled toward the global mean in proportion to how little evidence
 * stands behind it:
 *
 *   score = (voters * mean + m * global) / (voters + m)
 *
 * One 10.0 lands near the global average because one opinion is barely
 * evidence; nine people at 9.0 barely move, because nine is. Nothing is
 * excluded and no arbitrary floor is imposed, so a film climbs as it earns
 * ratings rather than appearing the instant it clears a threshold.
 *
 * `m` is the 75th percentile of ratings-per-film rather than a constant, so it
 * tracks the size of the crowd. At nine users that is a small number and the
 * board still moves; at ten thousand it rises on its own and a handful of
 * votes stops being enough. A frozen constant would quietly stop working.
 *
 * Each person's current rating only, never a stale one an unrated rewatch
 * would otherwise erase, and private entries are excluded throughout.
 */
/**
 * Films and series are ranked apart, not together.
 *
 * Collapsing a series onto one row is right, and it has a side effect: twenty
 * people's opinions land on one title where a film usually carries one or two.
 * The weighting rewards agreement, so on a single board television takes the
 * whole top and it reads as a verdict about the medium rather than about any
 * of the titles. They are different things to be the best of.
 */
export async function getGlobalTopRated(
  limit = 10,
  kind: "movie" | "show" = "movie",
): Promise<TopRatedFilm[]> {
  const wantShows = kind === "show";
  const rows = await db.execute(sql`
    with current as (
      select distinct on (user_id, film_id) user_id, film_id, rating
      from diary_entries
      where rating is not null and private = false
      order by user_id, film_id, watched_on desc nulls last, created_at desc
    ),
    /**
     * One opinion per person per *work*, before anything is averaged.
     *
     * Grouping by film_id put every season on the board as its own title, so a
     * nine-season programme arrived as nine entries competing with each other
     * and with films — and none of them was the thing anybody would say they
     * loved. Television opinion lives on the seasons here, so the collapse has
     * to happen before the crowd mean, not after.
     *
     * A person's verdict on a series is the one they typed about the whole
     * thing when they typed one, and otherwise the mean of the seasons they
     * rated. The same order the library and the mutual-loves query use, so all
     * three agree about what somebody thinks of a show.
     */
    per_user as (
      select c.user_id,
             coalesce(f.show_id, f.id) as work_id,
             (f.show_id is not null) as is_show,
             coalesce(
               max(c.rating) filter (where f.kind = 'movie'),
               max(c.rating) filter (where f.kind = 'show'),
               round(avg(c.rating) filter (where f.kind = 'season'))
             )::int as rating
      from current c join films f on f.id = c.film_id
      group by c.user_id, coalesce(f.show_id, f.id), (f.show_id is not null)
    ),
    means as (
      select work_id, is_show, avg(rating)::float as mean, count(*)::int as voters
      from per_user
      where rating is not null and is_show = ${wantShows}
      group by work_id, is_show
    ),
    prior as (
      select
        (select avg(rating)::float from current) as global_mean,
        greatest(2, percentile_cont(0.75) within group (order by voters))::float as weight
      from means
    )
    select
      m.is_show,
      case when m.is_show then sh.slug else f.slug end as slug,
      case when m.is_show then sh.name else f.title end as title,
      case when m.is_show then sh.first_air_year else f.year end as year,
      -- A series is credited to whoever made it, which is a creator rather
      -- than a director; the column below is only ever read as a byline.
      case when m.is_show then sh.creators ->> 0 else f.director end as director,
      case when m.is_show then sh.poster_path else f.poster_path end as poster_path,
      m.mean, m.voters
    from means m
    cross join prior p
    left join films f on f.id = m.work_id and m.is_show = false
    left join shows sh on sh.id = m.work_id and m.is_show = true
    where coalesce(sh.slug, f.slug) is not null
    order by
      (m.voters * m.mean + p.weight * p.global_mean) / (m.voters + p.weight) desc,
      m.voters desc,
      coalesce(sh.name, f.title) asc
    limit ${limit}
  `);

  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    slug: r.slug as string,
    title: r.title as string,
    year: r.year as number | null,
    director: (r.director as string) ?? null,
    posterPath: (r.poster_path as string) ?? null,
    mean: Math.round(r.mean as number),
    voters: r.voters as number,
    kind: r.is_show ? "show" : "movie",
  }));
}
