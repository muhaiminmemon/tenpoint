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
export async function getGlobalTopRated(limit = 10): Promise<TopRatedFilm[]> {
  const rows = await db.execute(sql`
    with current as (
      select distinct on (user_id, film_id) user_id, film_id, rating
      from diary_entries
      where rating is not null and private = false
      order by user_id, film_id, watched_on desc nulls last, created_at desc
    ),
    means as (
      select film_id, avg(rating)::float as mean, count(*)::int as voters
      from current
      group by film_id
    ),
    prior as (
      select
        (select avg(rating)::float from current) as global_mean,
        greatest(2, percentile_cont(0.75) within group (order by voters))::float as weight
      from means
    )
    select f.slug, f.title, f.year, f.director, f.poster_path, m.mean, m.voters
    from means m
    cross join prior p
    join films f on f.id = m.film_id
    order by
      (m.voters * m.mean + p.weight * p.global_mean) / (m.voters + p.weight) desc,
      m.voters desc,
      f.title asc
    limit ${limit}
  `);

  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    slug: r.slug as string,
    title: r.title as string,
    year: r.year as number | null,
    director: r.director as string | null,
    posterPath: r.poster_path as string | null,
    mean: Math.round(r.mean as number),
    voters: r.voters as number,
  }));
}
