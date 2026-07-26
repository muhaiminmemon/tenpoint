import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, diaryEntries, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { areFriends, isBlockedBetween } from "@/lib/social";

const schema = z.object({
  entryId: z.string().uuid(),
  body: z.string().min(1).max(5000),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "comment", LIMITS.write, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const entry = (
    await db
      .select({
        id: diaryEntries.id,
        userId: diaryEntries.userId,
        review: diaryEntries.review,
        private: diaryEntries.private,
      })
      .from(diaryEntries)
      .where(eq(diaryEntries.id, parsed.data.entryId))
      .limit(1)
  )[0];
  if (!entry || !entry.review || entry.private) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  if (entry.userId !== user.id) {
    // Putting text in front of a stranger is the action that costs a working
    // inbox. Replying under your own review doesn't reach anyone new, so it
    // stays available while an account is still unverified.
    if (!user.emailVerifiedAt) {
      return NextResponse.json(
        { error: "Confirm your email address before commenting on other people's reviews." },
        { status: 403 },
      );
    }
    if (await isBlockedBetween(user.id, entry.userId)) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }
    const author = (
      await db
        .select({
          username: users.username,
          displayName: users.displayName,
          commentPermission: users.commentPermission,
        })
        .from(users)
        .where(eq(users.id, entry.userId))
        .limit(1)
    )[0];
    if (!author) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    if (author.commentPermission === "off") {
      return NextResponse.json(
        { error: `${author.displayName ?? author.username} has comments turned off.` },
        { status: 403 },
      );
    }
    const perm = author.commentPermission;
    if (perm === "friends" && !(await areFriends(user.id, entry.userId))) {
      return NextResponse.json(
        { error: "Only friends can comment on this review." },
        { status: 403 },
      );
    }
  }

  const created = await db
    .insert(comments)
    .values({ entryId: entry.id, userId: user.id, body: parsed.data.body })
    .returning();
  return NextResponse.json({ comment: created[0] });
}
