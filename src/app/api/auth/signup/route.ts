import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { sendVerification } from "@/lib/verify";

const RESERVED = new Set([
  "api", "film", "films", "import", "library", "login", "signup", "logout",
  "settings", "watchlist", "diary", "watch", "export", "friends", "lists",
  "search", "about", "help", "admin", "tenpoint", "invite", "feed",
  "privacy", "terms", "verify", "reset", "forgot", "account", "avatar",
]);

const schema = z.object({
  username: z
    .string()
    .min(2)
    .max(24)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Lowercase letters, numbers, and dashes only"),
  email: z.string().email(),
  password: z.string().min(8, "At least 8 characters").max(200),
});

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "signup", LIMITS.signup);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
      { status: 400 },
    );
  }
  const { username, email, password } = parsed.data;

  if (RESERVED.has(username)) {
    return NextResponse.json({ error: "That username is reserved. Pick another." }, { status: 400 });
  }

  const existing = await db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, email.toLowerCase())))
    .limit(1);
  if (existing[0]) {
    const taken = existing[0].username === username ? "username" : "email";
    return NextResponse.json({ error: `That ${taken} is taken.` }, { status: 409 });
  }

  const created = await db
    .insert(users)
    .values({
      username,
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
    })
    .returning({ id: users.id });

  await createSession(created[0].id);
  // Signed in straight away; verification gates being findable, not access.
  await sendVerification({ id: created[0].id, username, email: email.toLowerCase() });
  return NextResponse.json({ ok: true });
}
