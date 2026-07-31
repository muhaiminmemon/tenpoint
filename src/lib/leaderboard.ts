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
 * The highest-rated films across everyone here, each film's current rating
 * per person (never a stale one an unrated rewatch would otherwise erase),
 * private entries excluded. Ties break by voter count, then title, so a
 * single 10 never outranks a film ten people love.
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
    )
    select f.slug, f.title, f.year, f.director, f.poster_path, m.mean, m.voters
    from means m
    join films f on f.id = m.film_id
    order by m.mean desc, m.voters desc, f.title asc
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
