import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { imports } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { filmKey, mapLimit, matchFilm, type ImportPayload } from "@/lib/importer";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

/** 30 titles per call, each possibly a TMDB search: past the 10s default. */
export const maxDuration = 60;

const CHUNK = 30;

const schema = z.object({ importId: z.string().uuid() });

/** Matches the next chunk of unmatched films. The client calls this in a loop. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "import-match", LIMITS.importMatch, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const row = (
    await db
      .select()
      .from(imports)
      .where(and(eq(imports.id, parsed.data.importId), eq(imports.userId, user.id)))
      .limit(1)
  )[0];
  if (!row || row.status !== "previewed") {
    return NextResponse.json({ error: "Import not found." }, { status: 404 });
  }

  const payload = row.payload as ImportPayload;
  const uniqueKeys = new Map<string, { name: string; year: number | null }>();
  for (const r of payload.rows) {
    const k = filmKey(r);
    if (!(k in payload.matches) && !uniqueKeys.has(k)) {
      uniqueKeys.set(k, { name: r.name, year: r.year });
    }
  }

  const batch = [...uniqueKeys.entries()].slice(0, CHUNK);
  const results = await mapLimit(batch, 8, async ([key, film]) => {
    try {
      return [key, await matchFilm(film.name, film.year)] as const;
    } catch {
      // TMDB hiccup: leave unattempted so a later pass retries
      return [key, undefined] as const;
    }
  });

  for (const [key, match] of results) {
    if (match !== undefined) payload.matches[key] = match;
  }

  await db.update(imports).set({ payload }).where(eq(imports.id, row.id));

  const remaining = uniqueKeys.size - batch.filter(([k]) => k in payload.matches).length;
  return NextResponse.json({
    matches: Object.fromEntries(results.filter(([, m]) => m !== undefined)),
    remaining,
  });
}
