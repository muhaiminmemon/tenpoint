import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invites } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { requireVerified } from "@/lib/http";

/** Returns the user's shareable invite link, creating it on first use. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const unverified = requireVerified(user);
  if (unverified) return unverified;

  const existing = await db
    .select()
    .from(invites)
    .where(eq(invites.userId, user.id))
    .limit(1);
  const token = existing[0]?.token ?? randomBytes(12).toString("hex");
  if (!existing[0]) {
    await db.insert(invites).values({ token, userId: user.id });
  }

  const origin = new URL(req.url).origin;
  return NextResponse.json({ url: `${origin}/invite/${token}` });
}
