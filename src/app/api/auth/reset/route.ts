import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumeEmailToken, destroyAllSessions, hashPassword } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

const schema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8, "At least 8 characters").max(200),
});

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "reset", LIMITS.auth);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Bad request." },
      { status: 400 },
    );
  }

  const userId = await consumeEmailToken(parsed.data.token, "reset");
  if (!userId) {
    return NextResponse.json(
      { error: "That link has expired or already been used. Ask for a new one." },
      { status: 400 },
    );
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.password),
      // Reaching the inbox proves the address, so this doubles as verification.
      emailVerifiedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Whoever knew the old password loses every session they had. If the reset
  // was prompted by a compromise, this is the part that ends it.
  await destroyAllSessions(userId);

  return NextResponse.json({ ok: true });
}
