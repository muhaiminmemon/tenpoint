import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  destroyOtherSessions,
  getSessionUser,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "At least 8 characters").max(200),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "password-change", LIMITS.auth, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Bad request." },
      { status: 400 },
    );
  }

  const row = (
    await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
  )[0];
  if (!row || !(await verifyPassword(parsed.data.currentPassword, row.passwordHash))) {
    return NextResponse.json({ error: "That current password isn't right." }, { status: 401 });
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword) })
    .where(eq(users.id, user.id));

  // Changing a password should end any session someone else got hold of, while
  // leaving the person who just did it signed in.
  await destroyOtherSessions(user.id);

  return NextResponse.json({ ok: true });
}
