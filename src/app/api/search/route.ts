import { NextResponse } from "next/server";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { films } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { releaseYear, searchMovies, searchShows, TmdbError } from "@/lib/tmdb";
import { shows } from "@/db/schema";

export type SearchResult = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** present once the film is in the local catalogue, so we can link directly */
  slug?: string | null;
  director?: string | null;
  /** the viewer's current rating, when they've rated it */
  rating?: number | null;
  /**
   * "show" on a series, absent on a film.
   *
   * A show is not rated here, its seasons are, so a hit opens the show page
   * rather than a rating panel. The palette needs to know that before the
   * click, which is the only reason this leaks into the result shape.
   */
  kind?: "show";
  /** shows carry their own slug space, so the link is built from this */
  showSlug?: string | null;
};

/** TMDB search merged with the local catalogue (pg_trgm handles typos). */
export async function GET(req: Request) {
  // Every miss is a TMDB call on our key, so this is their quota being spent.
  const limited = enforceRateLimit(req, "film-search", LIMITS.search);
  if (limited) return limited;

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const results: SearchResult[] = [];
  const seen = new Set<number>();
  /** how popular each hit is, kept beside the result so ranking can use it */
  const pop = new Map<SearchResult, number>();

  try {
    for (const m of (await searchMovies(q)).slice(0, 12)) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      const r: SearchResult = {
        tmdbId: m.id,
        title: m.title,
        year: releaseYear(m),
        posterPath: m.poster_path ?? null,
      };
      pop.set(r, m.popularity ?? 0);
      results.push(r);
    }
  } catch (e) {
    if (!(e instanceof TmdbError)) throw e;
    // fall back to the local catalogue only
  }

  /**
   * Series, searched separately because TMDB keeps them in another index.
   *
   * Fewer of them than films, and after them in the list, because somebody
   * typing into a film diary usually means a film. A show that is genuinely
   * the better match still surfaces: the local pass below promotes anything
   * already in the catalogue.
   */
  const showHits: SearchResult[] = [];
  try {
    for (const t of (await searchShows(q)).slice(0, 8)) {
      const r: SearchResult = {
        tmdbId: t.id,
        title: t.name,
        year: Number.parseInt((t.first_air_date ?? "").slice(0, 4), 10) || null,
        posterPath: t.poster_path ?? null,
        kind: "show",
      };
      pop.set(r, t.popularity ?? 0);
      showHits.push(r);
    }
  } catch (e) {
    if (!(e instanceof TmdbError)) throw e;
  }

  try {
    const local = await db
      .select({
        tmdbId: films.tmdbId,
        title: films.title,
        year: films.year,
        posterPath: films.posterPath,
        slug: films.slug,
        director: films.director,
      })
      .from(films)
      // Films only. Seasons and whole-series rows live in this table too, so
      // an unfiltered search answered "breaking bad" with four rows reading
      // "Breaking Bad: Season 3" that linked to /film/, which is not where a
      // season is rated. Series reach this list through their own search.
      .where(sql`${films.kind} = 'movie' and similarity(${films.title}, ${q}) > 0.3`)
      .orderBy(sql`similarity(${films.title}, ${q}) desc`)
      .limit(8);
    for (const f of local) {
      if (f.tmdbId === null || seen.has(f.tmdbId)) continue;
      seen.add(f.tmdbId);
      results.push(f as SearchResult);
    }
  } catch {
    // pg_trgm not installed yet, so TMDB results alone are fine
  }

  if (showHits.length) {
    const known = await db
      .select({ tmdbId: shows.tmdbId, slug: shows.slug })
      .from(shows)
      .where(inArray(shows.tmdbId, showHits.map((h) => h.tmdbId)));
    const bySlug = new Map(known.map((k) => [k.tmdbId, k.slug]));
    for (const h of showHits) h.showSlug = bySlug.get(h.tmdbId) ?? null;
  }

  // Series are deliberately kept out of `results` until the very end. They
  // used to be appended here, before the enrichment pass below, and that pass
  // looks films up by TMDB id: movie and television ids are separate spaces
  // and do collide, so a series could be handed an unrelated film's slug and
  // link to it.

  // Fill in slug/director for TMDB hits we already hold, and the viewer's own
  // rating, so the palette can show what they thought without a second trip.
  const tmdbIds = results.filter((r) => r.kind !== "show").map((r) => r.tmdbId);
  if (tmdbIds.length) {
    const user = await getSessionUser();
    const known = await db
      .select({
        tmdbId: films.tmdbId,
        id: films.id,
        slug: films.slug,
        director: films.director,
      })
      .from(films)
      .where(inArray(films.tmdbId, tmdbIds));

    const byTmdb = new Map(known.map((k) => [k.tmdbId, k]));
    let ratingByFilm = new Map<string, number>();

    if (user && known.length) {
      const rated = await db.execute(sql`
        select distinct on (film_id) film_id, rating
        from diary_entries
        where user_id = ${user.id}
          and rating is not null
          and film_id in (${sql.join(known.map((k) => sql`${k.id}`), sql`, `)})
        order by film_id, watched_on desc nulls last, created_at desc
      `);
      ratingByFilm = new Map(
        (rated as unknown as Record<string, unknown>[]).map((r) => [
          r.film_id as string,
          r.rating as number,
        ]),
      );
    }

    for (const r of results) {
      const k = byTmdb.get(r.tmdbId);
      if (!k) continue;
      r.slug = k.slug;
      r.director = r.director ?? k.director;
      r.rating = ratingByFilm.get(k.id) ?? null;
    }
  }

  /**
   * One ranking over both kinds, rather than every film before any series.
   *
   * Films were gathered first and there are always more than twelve of them,
   * so cutting the list to twelve landed the cut before the first series: no
   * search on the site could return a television programme, however plainly
   * somebody typed its name. Reserving slots fixed that and left the real
   * problem, which is that "severance" answered with eleven obscure films and
   * put the series last.
   *
   * So both kinds are scored together. How well the title matches what was
   * typed dominates, because somebody typing a title in full wants that thing
   * and nothing else; popularity only separates the ties, on a log scale so a
   * blockbuster cannot outrank an exact match. Anything already in the
   * catalogue gets a nudge, since it is the one we can link straight to.
   */
  // A leading article is not part of what anybody types. Without dropping it
  // "godfather" scored The Godfather as a mere substring hit and put an
  // obscure 2022 film called GodFather above it.
  const norm = (t: string) =>
    t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/^(the|a|an) /, "");
  const nq = norm(q);
  const score = (r: SearchResult) => {
    const t = norm(r.title);
    let n = Math.log10(1 + Math.max(0, pop.get(r) ?? 0));
    if (t === nq) n += 8;
    else if (t.startsWith(nq)) n += 4;
    else if (t.includes(nq)) n += 1.5;
    if (r.slug || r.showSlug) n += 1;
    return n;
  };

  const LIMIT = 12;
  /**
   * A floor, not a quota. Ranking alone usually surfaces the right series, but
   * a common word ("godfather") can fill twelve slots with films and bury a
   * series somebody may well have meant. Two are kept back for that case.
   */
  const SHOW_FLOOR = 2;
  const ranked = [...results, ...showHits].sort((a, b) => score(b) - score(a));

  const top = ranked.slice(0, LIMIT);
  const missing = SHOW_FLOOR - top.filter((r) => r.kind === "show").length;
  if (missing > 0) {
    const held = showHits
      .filter((h) => !top.includes(h))
      .sort((a, b) => score(b) - score(a))
      .slice(0, missing);
    top.splice(LIMIT - held.length, held.length, ...held);
  }

  return NextResponse.json({ results: top });
}
