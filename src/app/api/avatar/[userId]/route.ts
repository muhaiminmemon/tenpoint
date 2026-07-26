import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { avatars } from "@/db/schema";

/**
 * Avatars, served as real image responses rather than inlined into every page
 * that mentions a user.
 *
 * Public on purpose: an avatar is shown next to a username anywhere that
 * username is already visible, and gating it behind the profile privacy check
 * would mean a session lookup on every image request for no privacy gained.
 * Nothing here reveals anything the profile page doesn't.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const { userId } = await ctx.params;

  // A malformed id would otherwise reach Postgres as an invalid uuid literal
  // and throw rather than 404.
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return new NextResponse(null, { status: 404 });
  }

  const row = (
    await db
      .select({ mimeType: avatars.mimeType, data: avatars.data })
      .from(avatars)
      .where(eq(avatars.userId, userId))
      .limit(1)
  )[0];

  if (!row) return new NextResponse(null, { status: 404 });

  return new NextResponse(Buffer.from(row.data, "base64"), {
    headers: {
      "Content-Type": row.mimeType,
      // Safe to pin: the `?v=` stamp in the URL changes on every upload, so a
      // cached response can never be the stale one.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
