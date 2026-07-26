import { NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { blocks, friendRequests } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { removeFriendship } from "@/lib/social";

const schema = z.object({ userId: z.string().uuid() });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "block", LIMITS.write, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.userId === user.id) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  await db
    .insert(blocks)
    .values({ blockerId: user.id, blockedId: parsed.data.userId })
    .onConflictDoNothing();
  // blocking ends the friendship too
  await removeFriendship(user.id, parsed.data.userId);
  // and drops any request still pending in either direction, so a blocked
  // person can't sit in the other's inbox
  await db
    .delete(friendRequests)
    .where(
      or(
        and(
          eq(friendRequests.fromId, user.id),
          eq(friendRequests.toId, parsed.data.userId),
        ),
        and(
          eq(friendRequests.fromId, parsed.data.userId),
          eq(friendRequests.toId, user.id),
        ),
      ),
    );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  await db
    .delete(blocks)
    .where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, parsed.data.userId)));
  return NextResponse.json({ ok: true });
}
