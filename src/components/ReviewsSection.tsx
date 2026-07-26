import Link from "next/link";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { comments, diaryEntries, users, type SessionUser } from "@/db/schema";
import { blockedIdsFor, friendIdsOf } from "@/lib/social";
import { formatTenths } from "@/lib/format";
import { avatarSrc } from "@/lib/avatar";
import ReviewCard, { type ReviewData } from "./ReviewCard";

type Props = {
  filmId: string;
  filmSlug: string;
  viewer: SessionUser | null;
  tab: "friends" | "recent";
};

/** Reviews are chronological. No top review, no like counts, no algorithm. */
export default async function ReviewsSection({ filmId, filmSlug, viewer, tab }: Props) {
  const rows = await db
    .select({
      id: diaryEntries.id,
      review: diaryEntries.review,
      spoiler: diaryEntries.spoiler,
      rating: diaryEntries.rating,
      watchedOn: diaryEntries.watchedOn,
      createdAt: diaryEntries.createdAt,
      authorId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUpdatedAt: users.avatarUpdatedAt,
      privacy: users.privacy,
    })
    .from(diaryEntries)
    .innerJoin(users, eq(users.id, diaryEntries.userId))
    .where(
      and(
        eq(diaryEntries.filmId, filmId),
        isNotNull(diaryEntries.review),
        eq(diaryEntries.private, false),
      ),
    )
    .orderBy(desc(diaryEntries.createdAt))
    .limit(100);

  const friendIds = viewer ? new Set(await friendIdsOf(viewer.id)) : new Set<string>();
  const blocked = viewer ? await blockedIdsFor(viewer.id) : new Set<string>();

  const visible = rows.filter((r) => {
    if (blocked.has(r.authorId)) return false;
    if (viewer?.id === r.authorId) return true;
    if (r.privacy === "public") return true;
    if (r.privacy === "friends") return friendIds.has(r.authorId);
    return false;
  });

  const shown = (
    tab === "friends"
      ? visible.filter((r) => friendIds.has(r.authorId) || r.authorId === viewer?.id)
      : visible
  ).slice(0, 30);

  const commentRows = shown.length
    ? await db
        .select({
          id: comments.id,
          entryId: comments.entryId,
          body: comments.body,
          createdAt: comments.createdAt,
          username: users.username,
          displayName: users.displayName,
          authorId: users.id,
        })
        .from(comments)
        .innerJoin(users, eq(users.id, comments.userId))
        .where(inArray(comments.entryId, shown.map((r) => r.id)))
        .orderBy(comments.createdAt)
    : [];

  const reviews: ReviewData[] = shown.map((r) => ({
    id: r.id,
    review: r.review!,
    spoiler: r.spoiler,
    rating: r.rating !== null ? formatTenths(r.rating) : null,
    watchedOn: r.watchedOn,
    username: r.username,
    displayName: r.displayName,
    avatarUrl: avatarSrc(r.authorId, r.avatarUpdatedAt),
    comments: commentRows
      .filter((c) => c.entryId === r.id && !blocked.has(c.authorId))
      .map((c) => ({
        id: c.id,
        body: c.body,
        username: c.username,
        displayName: c.displayName,
        mine: c.authorId === viewer?.id,
      })),
  }));

  return (
    <section>
      <div className="mb-3 flex items-center gap-1 text-sm" role="tablist" aria-label="Reviews">
        {(["friends", "recent"] as const).map((t) => (
          <Link
            key={t}
            role="tab"
            aria-selected={tab === t}
            href={`/film/${filmSlug}?reviews=${t}`}
            className={`rounded-card px-3 py-1 ${
              tab === t ? "bg-tray-2 text-paper" : "text-ash hover:text-paper"
            }`}
          >
            {t === "friends" ? "Friends" : "Recent"}
          </Link>
        ))}
      </div>
      {reviews.length === 0 ? (
        <p className="text-sm text-ash">
          {tab === "friends"
            ? "None of your friends has reviewed this yet."
            : "No reviews yet. Log a viewing and write the first one."}
        </p>
      ) : (
        <ul className="space-y-5">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} signedIn={Boolean(viewer)} />
          ))}
        </ul>
      )}
    </section>
  );
}
