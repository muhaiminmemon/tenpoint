import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { diaryEntries, films } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { revalidateAfterEntryChange } from "@/lib/revalidate";
import { syncUserTier } from "@/lib/taste";
import { isUnreleased } from "@/lib/films";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

const schema = z.object({
  filmId: z.string().uuid(),
  watchedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  rating: z.number().int().min(10).max(100).nullable().optional(),
  review: z.string().max(20000).nullable().optional(),
  spoiler: z.boolean().optional(),
  private: z.boolean().optional(),
  rewatch: z.boolean().optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "entry", LIMITS.write, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { filmId, watchedOn, rating, review, spoiler, private: priv, rewatch } = parsed.data;

  const film = (
    await db
      .select({ id: films.id, title: films.title, releaseDate: films.releaseDate })
      .from(films)
      .where(eq(films.id, filmId))
      .limit(1)
  )[0];
  if (!film) return NextResponse.json({ error: "Film not found." }, { status: 404 });

  // Enforced here rather than only in the UI: the field is disabled on the
  // film page, but the endpoint is the thing that actually writes, and a
  // record that claims someone watched a film before it existed is exactly
  // the kind of dishonesty this diary is built to refuse.
  if (isUnreleased(film)) {
    return NextResponse.json(
      { error: `${film.title} isn't out yet. It can be logged once it's released.` },
      { status: 409 },
    );
  }

  const created = await db
    .insert(diaryEntries)
    .values({
      userId: user.id,
      filmId,
      watchedOn: watchedOn ?? null,
      rating: rating ?? null,
      review: review ?? null,
      spoiler: spoiler ?? false,
      private: priv ?? false,
      rewatch: rewatch ?? false,
    })
    .returning();

  await syncUserTier(user.id);
  revalidateAfterEntryChange(user.username);
  return NextResponse.json({ entry: created[0] });
}
