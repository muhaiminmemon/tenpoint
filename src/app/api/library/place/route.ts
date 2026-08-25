import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createEntry } from "@/lib/entries";
import { ensureFilm } from "@/lib/films";
import { getRankedLibrary, type LibraryFilm } from "@/lib/library";
import { keepTheSpot } from "@/lib/library-order";
import { ratingFromNeighbours, WINDOW } from "@/lib/placement";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { ensureShow, showRow } from "@/lib/shows";
import { movieDetails } from "@/lib/tmdb";

const schema = z.object({
  /** the work being logged, as TMDB numbers it; movies and series have separate id spaces */
  tmdbId: z.number().int().positive(),
  kind: z.enum(["movie", "show"]),
  /**
   * The titles actually either side of the gap, nearest first.
   *
   * Ids rather than an index, because the shelf may be filtered and the title
   * above a gap under "Anime" is not the one sitting at that index unfiltered.
   * The rating comes from what the person saw.
   */
  above: z.array(z.string().uuid()).max(WINDOW),
  below: z.array(z.string().uuid()).max(WINDOW),
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
  const { tmdbId, kind, above, below, rating: given, ...entry } = parsed.data;

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
  const byId = new Map(library.map((f) => [f.filmId, f]));
  const rowsFor = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((f): f is LibraryFilm => !!f && f.rating !== null);

  const aboveRows = rowsFor(above);
  const belowRows = rowsFor(below);
  if (aboveRows.length !== above.length || belowRows.length !== below.length) {
    return NextResponse.json(
      { error: "Your library changed while that was open. Reload and try again." },
      { status: 409 },
    );
  }

  const rating =
    given ??
    ratingFromNeighbours(
      aboveRows.map((f) => f.rating!),
      belowRows.map((f) => f.rating!),
    );

  const result = await createEntry({ ...entry, userId: user.id, username: user.username, filmId, rating });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  if (rating !== null) {
    await keepTheSpot(user.id, filmId, rating, aboveRows[0] ?? null, belowRows[0] ?? null, rated);
  }

  return NextResponse.json({ entry: result.entry, rating });
}
