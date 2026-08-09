import Link from "next/link";
import { and, desc, eq, inArray, or, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { comments, diaryEntries, films, users, type SessionUser } from "@/db/schema";
import { blockedIdsFor, friendIdsOf } from "@/lib/social";
import { formatTenths, ratingColor } from "@/lib/format";
import { avatarSrc } from "@/lib/avatar";
import Avatar from "./Avatar";
import ReviewCard, { type ReviewData } from "./ReviewCard";

type Props = {
  /**
   * Every row an opinion could be attached to.
   *
   * A film is one. A series is the whole-series row plus each of its seasons,
   * because that is where television opinion actually lives: a show page that
   * read only its own row showed nobody, since almost everybody rates seasons.
   */
  filmIds: string[];
  /** where the tabs link back to, e.g. `/film/heat-1995` or `/show/severance` */
  basePath: string;
  viewer: SessionUser | null;
  tab: "friends" | "recent";
};

/** Reviews are chronological. No top review, no like counts, no algorithm. */
export default async function ReviewsSection({ filmIds, basePath, viewer, tab }: Props) {
  if (filmIds.length === 0) return null;

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
      // Which part of the series this opinion is about. Null for a film, and
      // ignored when only one row was asked for.
      partKind: films.kind,
      partSeason: films.seasonNumber,
    })
    .from(diaryEntries)
    .innerJoin(users, eq(users.id, diaryEntries.userId))
    .innerJoin(films, eq(films.id, diaryEntries.filmId))
    .where(
      and(
        inArray(diaryEntries.filmId, filmIds),
        or(isNotNull(diaryEntries.review), isNotNull(diaryEntries.rating)),
        eq(diaryEntries.private, false),
      ),
    )
    .orderBy(desc(diaryEntries.createdAt))
    .limit(100);

  /**
   * "Season 4", or "the whole series", or nothing at all.
   *
   * A rating of 9.2 under a series heading is ambiguous when it could belong
   * to any one of eight seasons, so the part is named. On a film page there is
   * only ever one row and the qualifier would be noise.
   */
  const partOf = (kind: string | null, season: number | null): string | null => {
    if (filmIds.length < 2) return null;
    if (kind === "season") return season === 0 ? "the specials" : `season ${season}`;
    return "the whole series";
  };

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

  // a row with review text renders as a full ReviewCard; a bare rating gets a
  // one-line activity row instead, so a silent 9/10 still shows up here
  type FeedRow =
    | { kind: "review"; data: ReviewData }
    | {
        kind: "rating";
        id: string;
        rating: number;
        watchedOn: string | null;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
        part: string | null;
      };

  const feed: FeedRow[] = shown.map((r) => {
    const avatarUrl = avatarSrc(r.authorId, r.avatarUpdatedAt);
    const part = partOf(r.partKind, r.partSeason);
    if (r.review !== null) {
      return {
        kind: "review",
        data: {
          id: r.id,
          review: r.review,
          spoiler: r.spoiler,
          rating: r.rating !== null ? formatTenths(r.rating) : null,
          part,
          watchedOn: r.watchedOn,
          username: r.username,
          displayName: r.displayName,
          avatarUrl,
          comments: commentRows
            .filter((c) => c.entryId === r.id && !blocked.has(c.authorId))
            .map((c) => ({
              id: c.id,
              body: c.body,
              username: c.username,
              displayName: c.displayName,
              mine: c.authorId === viewer?.id,
            })),
        },
      };
    }
    return {
      kind: "rating",
      id: r.id,
      rating: r.rating!,
      watchedOn: r.watchedOn,
      username: r.username,
      displayName: r.displayName,
      avatarUrl,
      part,
    };
  });

  return (
    <section>
      <div className="mb-3 flex items-center gap-1 text-sm" role="tablist" aria-label="Reviews">
        {(["friends", "recent"] as const).map((t) => (
          <Link
            key={t}
            role="tab"
            aria-selected={tab === t}
            href={`${basePath}?reviews=${t}`}
            // Switching the feed is not arriving somewhere new. Left to
            // itself a link scrolls to the top of the page, which on a phone
            // throws you back past the whole film to change one word.
            scroll={false}
            replace
            className={`rounded-card px-3 py-1 ${
              tab === t ? "bg-tray-2 text-paper" : "text-ash hover:text-paper"
            }`}
          >
            {t === "friends" ? "Friends" : "Recent"}
          </Link>
        ))}
      </div>
      {feed.length === 0 ? (
        <p className="text-sm text-ash">
          {tab === "friends"
            ? "None of your friends has rated or reviewed this yet."
            : "No ratings or reviews yet. Log a viewing to be the first."}
        </p>
      ) : (
        <ul className="space-y-5">
          {feed.map((item) =>
            item.kind === "review" ? (
              <ReviewCard key={item.data.id} review={item.data} signedIn={Boolean(viewer)} />
            ) : (
              <li key={item.id} className="flex items-center gap-2 border-b border-seam pb-4 text-sm">
                <Avatar
                  avatarUrl={item.avatarUrl}
                  name={item.displayName ?? item.username}
                  size={24}
                />
                <Link href={`/${item.username}`} className="text-paper hover:underline">
                  {item.displayName ?? item.username}
                </Link>
                <span className="text-ash">rated</span>
                {item.part && <span className="text-ash">{item.part}</span>}
                <span className={`num ${ratingColor(item.rating)}`}>
                  {formatTenths(item.rating)}
                </span>
                {item.watchedOn && (
                  <span className="num ml-auto text-xs text-ash">{item.watchedOn}</span>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
