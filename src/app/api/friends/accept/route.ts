import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { requireVerified } from "@/lib/http";
import { createFriendship, isBlockedBetween } from "@/lib/social";

const schema = z.object({ token: z.string().min(1) });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const unverified = requireVerified(user);
  if (unverified) return unverified;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const invite = (
    await db.select().from(invites).where(eq(invites.token, parsed.data.token)).limit(1)
  )[0];
  if (!invite) {
    return NextResponse.json(
      { error: "This invite link isn't valid. Ask your friend for a fresh one." },
      { status: 404 },
    );
  }
  if (invite.userId === user.id) {
    return NextResponse.json({ error: "That's your own invite link." }, { status: 400 });
  }
  if (await isBlockedBetween(user.id, invite.userId)) {
    return NextResponse.json({ error: "This invite link isn't valid." }, { status: 403 });
  }

  await createFriendship(user.id, invite.userId);
  const inviter = (
    await db.select({ username: users.username }).from(users).where(eq(users.id, invite.userId)).limit(1)
  )[0];

  return NextResponse.json({ ok: true, friend: inviter?.username });
}
