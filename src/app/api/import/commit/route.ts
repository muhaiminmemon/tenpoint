import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { diaryEntries, films, imports, watchlist } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { ensureFilm } from "@/lib/films";
import { ensureShow } from "@/lib/shows";
import { filmKey, userFilmSets, type ImportPayload, type Match } from "@/lib/importer";
import { sourceKey } from "@/lib/letterboxd";

const schema = z.object({
  importId: z.string().uuid(),
  corrections: z
    .record(
      z.string(),
      z.object({
        tmdbId: z.number(),
        title: z.string(),
        year: z.number().nullable(),
        posterPath: z.string().nullable(),
      }),
    )
    .default({}),
  skips: z.array(z.string()).default([]),
  /**
   * Bring the watching, leave the scores.
   *
   * Somebody moving here often wants to rate things again rather than inherit
   * a decade of numbers from a different scale and a younger version of
   * themselves. Applied at the commit rather than the parse so the review
   * screen can still show what the file said before they decide.
   */
  dropRatings: z.boolean().default(false),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { importId, corrections, skips, dropRatings } = parsed.data;

  const row = (
    await db
      .select()
      .from(imports)
      .where(and(eq(imports.id, importId), eq(imports.userId, user.id)))
      .limit(1)
  )[0];
  if (!row) return NextResponse.json({ error: "Import not found." }, { status: 404 });
  if (row.status === "committed") {
    return NextResponse.json({ error: "This import was already applied." }, { status: 409 });
  }

  const payload = row.payload as ImportPayload;
  const skipSet = new Set(skips);

  // resolve every unique matched film to a films row
  const resolved = new Map<string, Match>();
  for (const r of payload.rows) {
    const k = filmKey(r);
    if (skipSet.has(k) || resolved.has(k)) continue;
    const match = corrections[k] ?? payload.matches[k];
    if (match) resolved.set(k, match);
  }

  const filmIdByKey = new Map<string, string>();
  for (const [k, match] of resolved) {
    /**
     * A season resolves through its series.
     *
     * An anime list names a season, so the id in hand is the *show* and the
     * row wanted is one of its seasons. `ensureShow` brings the whole series
     * in, seasons and all, which is also what makes the rest of the site work
     * for it afterwards: the show page, the shelf, the completion states.
     */
    if (match.season != null) {
      const show = await ensureShow(match.tmdbId);
      if (!show) continue;
      const season = (
        await db
          .select({ id: films.id })
          .from(films)
          .where(
            and(
              eq(films.showId, show.id),
              eq(films.kind, "season"),
              eq(films.seasonNumber, match.season),
            ),
          )
          .limit(1)
      )[0];
      // A season the mapping believes in but TMDB does not list is dropped
      // rather than guessed at: better one missing row than a score filed
      // against the wrong season.
      if (season) filmIdByKey.set(k, season.id);
      continue;
    }

    const film = await ensureFilm({
      id: match.tmdbId,
      title: match.title,
      release_date: match.year ? `${match.year}-01-01` : undefined,
      poster_path: match.posterPath,
    });
    filmIdByKey.set(k, film.id);
  }

  const { logged, rated } = await userFilmSets(user.id);

  let diaryCount = 0;
  let ratingCount = 0;
  let watchedCount = 0;
  let watchlistCount = 0;
  let unmatched = 0;

  const order = { diary: 0, ratings: 1, watched: 2, watchlist: 3 };
  const rows = [...payload.rows]
    // A ratings-only row carries nothing but the score, so with the scores
    // dropped it becomes a record that they watched it.
    .map((r) =>
      dropRatings
        ? { ...r, rating: null, kind: r.kind === "ratings" ? ("watched" as const) : r.kind }
        : r,
    )
    .sort((a, b) => order[a.kind] - order[b.kind]);

  for (const r of rows) {
    const k = filmKey(r);
    if (skipSet.has(k)) continue;
    const filmId = filmIdByKey.get(k);
    if (!filmId) {
      unmatched++;
      continue;
    }

    if (r.kind === "diary") {
      const inserted = await db
        .insert(diaryEntries)
        .values({
          userId: user.id,
          filmId,
          watchedOn: r.watchedOn,
          rating: r.rating,
          rewatch: r.rewatch,
          importId,
          sourceKey: sourceKey(r),
        })
        .onConflictDoNothing()
        .returning({ id: diaryEntries.id });
      if (inserted.length) {
        diaryCount++;
        logged.add(filmId);
        if (r.rating !== null) rated.add(filmId);
      }
    } else if (r.kind === "ratings") {
      // ratings.csv duplicates diary ratings, so only fill films with no rated entry
      if (rated.has(filmId) || r.rating === null) continue;
      const inserted = await db
        .insert(diaryEntries)
        .values({
          userId: user.id,
          filmId,
          watchedOn: r.watchedOn,
          rating: r.rating,
          importId,
          sourceKey: sourceKey(r),
        })
        .onConflictDoNothing()
        .returning({ id: diaryEntries.id });
      if (inserted.length) {
        ratingCount++;
        logged.add(filmId);
        rated.add(filmId);
      }
    } else if (r.kind === "watched") {
      // watched.csv marks films seen, so only films not otherwise logged
      if (logged.has(filmId)) continue;
      const inserted = await db
        .insert(diaryEntries)
        .values({
          userId: user.id,
          filmId,
          watchedOn: r.watchedOn,
          rating: null,
          importId,
          sourceKey: sourceKey(r),
        })
        .onConflictDoNothing()
        .returning({ id: diaryEntries.id });
      if (inserted.length) {
        watchedCount++;
        logged.add(filmId);
      }
    } else {
      const inserted = await db
        .insert(watchlist)
        .values({
          userId: user.id,
          filmId,
          source: "Letterboxd import",
          importId,
        })
        .onConflictDoNothing()
        .returning({ id: watchlist.id });
      if (inserted.length) watchlistCount++;
    }
  }

  await db
    .update(imports)
    .set({ status: "committed", committedAt: new Date(), payload })
    .where(eq(imports.id, importId));

  return NextResponse.json({
    diary: diaryCount,
    ratings: ratingCount,
    watched: watchedCount,
    watchlist: watchlistCount,
    unmatched,
  });
}
