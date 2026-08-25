import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createEntry } from "@/lib/entries";
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

  const result = await createEntry({ ...parsed.data, userId: user.id, username: user.username });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ entry: result.entry });
}
