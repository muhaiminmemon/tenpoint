import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { watchlist } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

const addSchema = z.object({
  filmId: z.string().uuid(),
  source: z.string().max(200).nullable().optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "watchlist", LIMITS.write, user.id);
  if (limited) return limited;

  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  await db
    .insert(watchlist)
    .values({ userId: user.id, filmId: parsed.data.filmId, source: parsed.data.source ?? null })
    .onConflictDoUpdate({
      target: [watchlist.userId, watchlist.filmId],
      set: { source: parsed.data.source ?? null },
    });

  return NextResponse.json({ ok: true });
}

const patchSchema = z.object({
  filmId: z.string().uuid(),
  priority: z.enum(["urgent", "soon", "whenever"]).optional(),
  source: z.string().max(200).nullable().optional(),
});

/** Change how much you want to get to something, without re-adding it. */
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const { filmId, ...changes } = parsed.data;
  if (Object.values(changes).every((v) => v === undefined)) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const updated = await db
    .update(watchlist)
    .set(changes)
    .where(and(eq(watchlist.userId, user.id), eq(watchlist.filmId, filmId)))
    .returning({ id: watchlist.id });
  if (!updated[0]) return NextResponse.json({ error: "Not on your watchlist." }, { status: 404 });

  return NextResponse.json({ ok: true });
}

const removeSchema = z.object({ filmId: z.string().uuid() });

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = removeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  await db
    .delete(watchlist)
    .where(and(eq(watchlist.userId, user.id), eq(watchlist.filmId, parsed.data.filmId)));

  return NextResponse.json({ ok: true });
}
