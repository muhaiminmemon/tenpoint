import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

const schema = z.object({
  subjectType: z.enum(["user", "review", "comment"]),
  subjectId: z.string().min(1).max(200),
  reason: z.string().min(3).max(2000),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "report", LIMITS.write, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Add a short reason so we can act on the report." },
      { status: 400 },
    );
  }

  await db.insert(reports).values({ reporterId: user.id, ...parsed.data });
  return NextResponse.json({ ok: true });
}
