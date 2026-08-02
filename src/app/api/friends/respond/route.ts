import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { friendRequests } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { requireVerified } from "@/lib/http";
import { createFriendship } from "@/lib/social";

const schema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["accept", "decline"]),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const unverified = requireVerified(user);
  if (unverified) return unverified;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const request = (
    await db
      .select()
      .from(friendRequests)
      .where(
        and(eq(friendRequests.id, parsed.data.requestId), eq(friendRequests.toId, user.id)),
      )
      .limit(1)
  )[0];
  if (!request) {
    return NextResponse.json({ error: "Request not found. It may have been withdrawn." }, { status: 404 });
  }

  if (parsed.data.action === "accept") {
    await createFriendship(user.id, request.fromId);
  }
  await db.delete(friendRequests).where(eq(friendRequests.id, request.id));

  return NextResponse.json({ ok: true });
}
