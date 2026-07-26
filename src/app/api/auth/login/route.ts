import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { burnPasswordTiming, createSession, verifyPassword } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

const schema = z.object({
  identity: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "login", LIMITS.auth);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
  }
  const identity = parsed.data.identity.toLowerCase();

  const found = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(or(eq(users.username, identity), eq(users.email, identity)))
    .limit(1);
  const user = found[0];

  if (!user) {
    // Spend the same scrypt time a real account would, so response latency
    // doesn't answer "is this username registered?"
    await burnPasswordTiming(parsed.data.password);
    return NextResponse.json(
      { error: "Wrong username or password. Check both and try again." },
      { status: 401 },
    );
  }

  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Wrong username or password. Check both and try again." },
      { status: 401 },
    );
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
