import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { sendPasswordReset } from "@/lib/verify";

const schema = z.object({ identity: z.string().min(1).max(320) });

/**
 * Starts a password reset. Always answers the same way whether or not the
 * account exists — this endpoint is unauthenticated, so a distinguishable
 * response would turn it into a "does this person have an account?" oracle.
 */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "forgot", LIMITS.email);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your username or email." }, { status: 400 });
  }

  const identity = parsed.data.identity.trim().toLowerCase();
  const user = (
    await db
      .select({ id: users.id, username: users.username, email: users.email })
      .from(users)
      .where(or(eq(users.username, identity), eq(users.email, identity)))
      .limit(1)
  )[0];

  if (user) await sendPasswordReset(user);

  return NextResponse.json({ ok: true });
}
