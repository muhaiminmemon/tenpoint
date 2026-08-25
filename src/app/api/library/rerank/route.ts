import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { diaryEntries } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { updateEntry } from "@/lib/entries";
import { getRankedLibrary, type LibraryFilm } from "@/lib/library";
import { keepTheSpot } from "@/lib/library-order";
import { ratingFromNeighbours, WINDOW } from "@/lib/placement";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

const schema = z.object({
  filmId: z.string().uuid(),
  /**
   * The titles that were actually either side of the drop, nearest first.
   *
   * Sent as ids rather than derived from an index, because the shelf may be
   * filtered: under "Anime" the title above a drop can be fifty rows away in
   * the full ranking, and reading the rating off whatever sits at that index
   * unfiltered would answer a question nobody asked. What the person saw is
   * what the number comes from. The ratings themselves are still looked up
   * here — only the identities are taken on trust.
   */
  above: z.array(z.string().uuid()).max(WINDOW),
  below: z.array(z.string().uuid()).max(WINDOW),
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
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "entry", LIMITS.write, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { filmId, above, below } = parsed.data;

  if (above.includes(filmId) || below.includes(filmId)) {
    return NextResponse.json({ error: "A film can't sit next to itself." }, { status: 400 });
  }
  if (above.length === 0 && below.length === 0) {
    return NextResponse.json(
      { error: "Nothing either side to read a rating from." },
      { status: 409 },
    );
  }

  const library = await getRankedLibrary(user.id);
  if (!library.some((f) => f.filmId === filmId)) {
    return NextResponse.json({ error: "That isn't in your library." }, { status: 404 });
  }

  const byId = new Map(library.map((f) => [f.filmId, f]));
  const ratingsOf = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((f): f is LibraryFilm => !!f && f.rating !== null);

  const aboveRows = ratingsOf(above);
  const belowRows = ratingsOf(below);
  if (aboveRows.length !== above.length || belowRows.length !== below.length) {
    return NextResponse.json(
      { error: "Your library changed while that was open. Reload and try again." },
      { status: 409 },
    );
  }

  const rating = ratingFromNeighbours(
    aboveRows.map((f) => f.rating!),
    belowRows.map((f) => f.rating!),
  );
  if (rating === null) {
    return NextResponse.json(
      { error: "Nothing either side to read a rating from." },
      { status: 409 },
    );
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

  await keepTheSpot(
    user.id,
    filmId,
    rating,
    aboveRows[0] ?? null,
    belowRows[0] ?? null,
    library.filter((f) => f.rating !== null && f.filmId !== filmId),
  );

  return NextResponse.json({ rating });
}
