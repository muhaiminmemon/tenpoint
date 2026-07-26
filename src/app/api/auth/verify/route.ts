import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumeEmailToken, getSessionUser } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { sendVerification } from "@/lib/verify";

const schema = z.object({ token: z.string().min(1).max(200) });

/**
 * Redeems a verification token. A POST rather than a GET on the emailed link:
 * corporate mail scanners follow links to check them, and a GET would let a
 * scanner burn the single-use token before the user ever clicked.
 */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "verify", LIMITS.auth);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const userId = await consumeEmailToken(parsed.data.token, "verify");
  if (!userId) {
    return NextResponse.json(
      { error: "That link has expired or already been used. Request a new one." },
      { status: 400 },
    );
  }

  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}

/** Sends a fresh verification link to the signed-in user's address. */
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "verify-resend", LIMITS.email, user.id);
  if (limited) return limited;

  if (user.emailVerifiedAt) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  await sendVerification({ id: user.id, username: user.username, email: user.email });
  return NextResponse.json({ ok: true });
}
