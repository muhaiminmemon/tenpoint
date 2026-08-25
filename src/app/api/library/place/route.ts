import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { libraryOrder } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { createEntry } from "@/lib/entries";
import { ensureFilm } from "@/lib/films";
import { getRankedLibrary } from "@/lib/library";
import { needsRenumber, ratingFromNeighbours, sortKeyBetween } from "@/lib/placement";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { ensureShow, showRow } from "@/lib/shows";
import { movieDetails } from "@/lib/tmdb";

const schema = z.object({
  /** the work being logged, as TMDB numbers it; movies and series have separate id spaces */
  tmdbId: z.number().int().positive(),
  kind: z.enum(["movie", "show"]),
  /** the two titles the gap sits between; null at either end of the ranking */
  afterFilmId: z.string().uuid().nullable(),
  beforeFilmId: z.string().uuid().nullable(),
  /** set when the dial was used instead of the gap; otherwise the gap decides */
  rating: z.number().int().min(10).max(100).nullable(),
  watchedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  review: z.string().max(20000).nullable().optional(),
  spoiler: z.boolean().optional(),
  private: z.boolean().optional(),
});

/**
 * Logs a viewing into a gap in the ranked library.
 *
 * The rating is worked out here from a fresh read rather than taken from the
 * client, so a page left open while the library moved cannot file a film
 * against neighbours it no longer has.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "entry", LIMITS.write, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { tmdbId, kind, afterFilmId, beforeFilmId, rating: given, ...entry } = parsed.data;

  // The row that carries the rating: the film, or the whole-series row that
  // stands for a show. A bare season is not placed here; the season list owns
  // that, and it is the unit the show row is built from.
  let filmId: string;
  if (kind === "movie") {
    filmId = (await ensureFilm(await movieDetails(tmdbId))).id;
  } else {
    const show = await ensureShow(tmdbId);
    const row = show ? await showRow(show.id) : null;
    if (!row) return NextResponse.json({ error: "Series not found." }, { status: 404 });
    filmId = row.id;
  }

  const library = await getRankedLibrary(user.id);
  const rated = library.filter((f) => f.rating !== null);
  const at = beforeFilmId
    ? rated.findIndex((f) => f.filmId === beforeFilmId)
    : afterFilmId
      ? rated.findIndex((f) => f.filmId === afterFilmId) + 1
      : -1;

  if (at === -1 && (afterFilmId || beforeFilmId)) {
    return NextResponse.json(
      { error: "Your library changed while that was open. Reload and try again." },
      { status: 409 },
    );
  }

  const above = rated.slice(Math.max(0, at - 2), at).reverse();
  const below = rated.slice(at, at + 2);
  const rating =
    given ?? ratingFromNeighbours(above.map((f) => f.rating!), below.map((f) => f.rating!));

  const result = await createEntry({ ...entry, userId: user.id, username: user.username, filmId, rating });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  if (rating !== null) await keepTheSpot(user.id, filmId, rating, above[0] ?? null, below[0] ?? null);

  return NextResponse.json({ entry: result.entry, rating });
}

type Edge = { filmId: string; rating: number | null; sortKey: number } | null;

/**
 * Keeps the row where the gap was, when the rating alone would not.
 *
 * A rating nobody else holds sorts itself and needs nothing written. A rating
 * shared with a neighbour does: without a key, a film dropped between two tens
 * lands wherever the alphabet puts it, which is not where it was dropped.
 */
async function keepTheSpot(
  userId: string,
  filmId: string,
  rating: number,
  above: Edge,
  below: Edge,
) {
  const aboveKey = above && above.rating === rating ? above.sortKey : null;
  const belowKey = below && below.rating === rating ? below.sortKey : null;
  if (aboveKey === null && belowKey === null) return;

  let sortKey = sortKeyBetween(aboveKey, belowKey);

  if (needsRenumber(aboveKey, belowKey)) {
    // Number the band as it stands, once; every insert after this is one write.
    const band = await getRankedLibrary(userId).then((rows) =>
      rows.filter((f) => f.rating === rating),
    );
    await db.transaction(async (tx) => {
      for (const [i, f] of band.entries()) {
        const key = (i + 1) * 100;
        await tx
          .insert(libraryOrder)
          .values({ userId, filmId: f.filmId, sortKey: key })
          .onConflictDoUpdate({
            target: [libraryOrder.userId, libraryOrder.filmId],
            set: { sortKey: key },
          });
      }
    });
    const seat = band.findIndex((f) => f.filmId === below?.filmId);
    sortKey = seat === -1 ? (band.length + 1) * 100 : seat * 100 + 50;
  }

  await db
    .insert(libraryOrder)
    .values({ userId, filmId, sortKey })
    .onConflictDoUpdate({
      target: [libraryOrder.userId, libraryOrder.filmId],
      set: { sortKey },
    });
}
