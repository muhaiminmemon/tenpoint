import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { diaryEntries } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { updateEntry } from "@/lib/entries";
import { getRankedLibrary } from "@/lib/library";
import { keepTheSpot } from "@/lib/library-order";
import { ratingFromNeighbours } from "@/lib/placement";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

const schema = z.object({
  filmId: z.string().uuid(),
  /** the two titles the film was dropped between, with itself already taken out */
  afterFilmId: z.string().uuid().nullable(),
  beforeFilmId: z.string().uuid().nullable(),
});

/**
 * Moving a film on the shelf, and moving its rating with it.
 *
 * Dragging is the whole gesture: there is no confirmation, because asking
 * "change 8.4 to 8.1?" after every drop would make re-ordering a shelf of
 * hundreds unusable, which is the thing this exists to make easy.
 *
 * What that costs is paid rather than skipped. A drop rewrites an opinion, and
 * a rewritten opinion has to keep the one it replaced, so this goes through
 * `updateEntry` — the same path the edit sheet uses — instead of setting the
 * column. Silent to the person dragging; permanent in the record.
 *
 * The rating is read here off a fresh library rather than taken from the
 * client, so a page left open while things moved cannot file a film against
 * neighbours it no longer has.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "entry", LIMITS.write, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { filmId, afterFilmId, beforeFilmId } = parsed.data;

  if (filmId === afterFilmId || filmId === beforeFilmId) {
    return NextResponse.json({ error: "A film can't sit next to itself." }, { status: 400 });
  }

  const library = await getRankedLibrary(user.id);
  if (!library.some((f) => f.filmId === filmId)) {
    return NextResponse.json({ error: "That isn't in your library." }, { status: 404 });
  }

  /**
   * The ranking as it will read once the film has left its old place.
   *
   * Taken out before the neighbours are counted, because a film dragged three
   * places down the same band would otherwise be read as one of the two titles
   * above its own destination.
   */
  const rest = library.filter((f) => f.rating !== null && f.filmId !== filmId);
  const at = beforeFilmId
    ? rest.findIndex((f) => f.filmId === beforeFilmId)
    : afterFilmId
      ? rest.findIndex((f) => f.filmId === afterFilmId) + 1
      : -1;

  if (at === -1) {
    return NextResponse.json(
      { error: "Your library changed while that was open. Reload and try again." },
      { status: 409 },
    );
  }

  const above = rest.slice(Math.max(0, at - 2), at).reverse();
  const below = rest.slice(at, at + 2);
  const rating = ratingFromNeighbours(
    above.map((f) => f.rating!),
    below.map((f) => f.rating!),
  );
  if (rating === null) {
    return NextResponse.json({ error: "Nothing either side to read a rating from." }, { status: 409 });
  }

  /**
   * The viewing that carries this row's current rating.
   *
   * The library shows the most recent rated entry, so that is the one a drag
   * revises. A row watched but never rated has no such entry; its latest
   * viewing takes the rating instead, and since there is nothing being
   * replaced, nothing is superseded.
   */
  const latest = (
    await db
      .select({ id: diaryEntries.id, rating: diaryEntries.rating })
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, user.id), eq(diaryEntries.filmId, filmId)))
      .orderBy(
        sql`${diaryEntries.rating} is null`,
        sql`${diaryEntries.watchedOn} desc nulls last`,
        desc(diaryEntries.createdAt),
      )
      .limit(1)
  )[0];
  if (!latest) return NextResponse.json({ error: "No viewing to rate." }, { status: 404 });

  if (latest.rating !== rating) {
    const result = await updateEntry(user.id, user.username, latest.id, { rating });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await keepTheSpot(user.id, filmId, rating, above[0] ?? null, below[0] ?? null, rest);

  return NextResponse.json({ rating });
}
