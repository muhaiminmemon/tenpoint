import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { safeUserColumns, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { recommendForPair } from "@/lib/recs";
import { areFriends } from "@/lib/social";

/**
 * A run reads both diaries, builds a taste neighbourhood across every account,
 * and scores several hundred candidates against both people. It calls nothing
 * outside the database, so it is fast, but the default 10s a serverless
 * platform allows a route handler is not a margin worth trusting as the
 * catalogue grows.
 */
export const maxDuration = 60;

const schema = z.object({
  friend: z.string().min(1),
  /** which half of the catalogue to draw from; defaults to both */
  media: z.enum(["all", "movie", "show", "anime"]).default("all"),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  // Per-account, not per-IP: a run is the most expensive read in the product.
  const limited = enforceRateLimit(req, "recs", LIMITS.recs, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const friend = (
    await db
      .select(safeUserColumns)
      .from(users)
      .where(eq(users.username, parsed.data.friend.toLowerCase()))
      .limit(1)
  )[0];
  if (!friend || !(await areFriends(user.id, friend.id))) {
    return NextResponse.json(
      { error: "You can only do this with a friend. Send them your invite link first." },
      { status: 403 },
    );
  }

  const result = await recommendForPair(user, friend, parsed.data.media);
  return NextResponse.json(result);
}
