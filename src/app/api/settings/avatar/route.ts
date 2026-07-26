import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { avatars, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { avatarSrc, MAX_AVATAR_BYTES, parseImageDataUrl } from "@/lib/avatar";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

// The client resizes to a small square JPEG before sending. Base64 inflates by
// ~4/3, and this bound is on the encoded string; `parseImageDataUrl` enforces
// the real byte limit after decoding.
const MAX_DATA_URL_LENGTH = Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 100;

const schema = z.object({
  dataUrl: z.string().startsWith("data:image/").max(MAX_DATA_URL_LENGTH, "That image is too large."),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "avatar", LIMITS.write, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Couldn't use that image." },
      { status: 400 },
    );
  }

  const image = parseImageDataUrl(parsed.data.dataUrl);
  if (!image) {
    return NextResponse.json(
      { error: "Use a JPEG, PNG, or WebP under 512 KB." },
      { status: 400 },
    );
  }

  const updatedAt = new Date();
  await db
    .insert(avatars)
    .values({ userId: user.id, mimeType: image.mimeType, data: image.base64, updatedAt })
    .onConflictDoUpdate({
      target: avatars.userId,
      set: { mimeType: image.mimeType, data: image.base64, updatedAt },
    });
  // The stamp is what every other query reads, and what busts the image cache.
  await db.update(users).set({ avatarUpdatedAt: updatedAt }).where(eq(users.id, user.id));

  return NextResponse.json({ ok: true, src: avatarSrc(user.id, updatedAt) });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  await db.delete(avatars).where(eq(avatars.userId, user.id));
  await db.update(users).set({ avatarUpdatedAt: null }).where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}
