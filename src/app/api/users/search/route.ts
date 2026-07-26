import { NextResponse } from "next/server";
import { isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { avatarSrc } from "@/lib/avatar";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { blockedIdsFor } from "@/lib/social";

/** Find people by username or display name. Typo-tolerant via pg_trgm. */
export async function GET(req: Request) {
  const limited = enforceRateLimit(req, "user-search", LIMITS.search);
  if (limited) return limited;

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const viewer = await getSessionUser();
  const blocked = viewer ? await blockedIdsFor(viewer.id) : new Set<string>();

  const pattern = `%${q.toLowerCase()}%`;
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUpdatedAt: users.avatarUpdatedAt,
    })
    .from(users)
    .where(
      sql`(${users.username} ilike ${pattern}
        or ${users.displayName} ilike ${pattern}
        or similarity(${users.username}, ${q.toLowerCase()}) > 0.3)
        -- unverified accounts are unlisted: signup is free, so being findable
        -- is the one thing that should cost a working inbox
        and ${isNotNull(users.emailVerifiedAt)}`,
    )
    .orderBy(sql`${users.username} ilike ${pattern} desc, similarity(${users.username}, ${q.toLowerCase()}) desc`)
    .limit(8);

  return NextResponse.json({
    results: rows
      .filter((r) => r.id !== viewer?.id && !blocked.has(r.id))
      .map(({ avatarUpdatedAt, ...r }) => ({
        ...r,
        avatarUrl: avatarSrc(r.id, avatarUpdatedAt),
      })),
  });
}
