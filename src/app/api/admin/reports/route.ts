import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["resolved", "dismissed", "open"]),
});

/** Close or reopen a report. Admin-only, checked here and not just in the UI. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  // A non-admin gets the same 404 an unauthenticated caller would: the
  // existence of a moderation endpoint isn't something to advertise. Checking
  // `user` explicitly rather than leaning on `isAdmin` alone is what lets the
  // compiler narrow it, instead of a `!` that would keep compiling if the
  // guard were ever weakened.
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const limited = enforceRateLimit(req, "admin-reports", LIMITS.write, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const open = parsed.data.status === "open";
  const updated = await db
    .update(reports)
    .set({
      status: parsed.data.status,
      resolvedBy: open ? null : user.id,
      resolvedAt: open ? null : new Date(),
    })
    .where(eq(reports.id, parsed.data.id))
    .returning({ id: reports.id });

  if (!updated[0]) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
