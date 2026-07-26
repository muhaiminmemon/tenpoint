import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { diaryEntries, films, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { friendIdsOf } from "@/lib/social";
import { formatTenths } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import { avatarSrc } from "@/lib/avatar";
import Avatar from "@/components/Avatar";

export const metadata = { title: "Feed" };

/** Friends only, strictly chronological. No algorithm. */
export default async function FeedPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const friendIds = await friendIdsOf(user.id);
  const entries = friendIds.length
    ? await db
        .select({
          id: diaryEntries.id,
          watchedOn: diaryEntries.watchedOn,
          rating: diaryEntries.rating,
          review: diaryEntries.review,
          spoiler: diaryEntries.spoiler,
          rewatch: diaryEntries.rewatch,
          createdAt: diaryEntries.createdAt,
          title: films.title,
          year: films.year,
          slug: films.slug,
          posterPath: films.posterPath,
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUpdatedAt: users.avatarUpdatedAt,
        })
        .from(diaryEntries)
        .innerJoin(films, eq(films.id, diaryEntries.filmId))
        .innerJoin(users, eq(users.id, diaryEntries.userId))
        .where(and(inArray(diaryEntries.userId, friendIds), eq(diaryEntries.private, false)))
        .orderBy(desc(diaryEntries.createdAt))
        .limit(100)
    : [];

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="display mb-6 text-2xl">Feed</h1>
      {entries.length === 0 ? (
        <p className="text-ash">
          Your friends&apos; logging shows up here.{" "}
          <Link href="/friends" className="text-paper underline">
            Invite someone
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <ul className="space-y-4">
          {entries.map((e) => {
            const poster = posterUrl(e.posterPath, "w154");
            return (
              <li key={e.id} className="flex gap-3 border-b border-seam pb-4">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poster}
                    alt={`Poster for ${e.title}`}
                    loading="lazy"
                    className="h-[72px] w-12 shrink-0 rounded-[3px] bg-tray object-cover"
                  />
                ) : (
                  <span className="h-[72px] w-12 shrink-0 rounded-[3px] bg-tray" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ash">
                    <span className="mr-1.5 inline-block align-middle">
                      <Avatar
                        avatarUrl={avatarSrc(e.userId, e.avatarUpdatedAt)}
                        name={e.displayName ?? e.username}
                        size={18}
                      />
                    </span>
                    <Link href={`/${e.username}`} className="text-paper hover:underline">
                      {e.displayName ?? e.username}
                    </Link>{" "}
                    {e.rewatch ? "rewatched" : "watched"}{" "}
                    <Link href={`/film/${e.slug}`} className="text-paper hover:underline">
                      {e.title}
                    </Link>{" "}
                    <span className="num">{e.year ?? ""}</span>
                    {e.watchedOn && <span className="num"> · {e.watchedOn}</span>}
                  </p>
                  {e.review && !e.spoiler && (
                    <p className="mt-1 line-clamp-3 text-sm text-ash">{e.review}</p>
                  )}
                  {e.review && e.spoiler && (
                    <p className="mt-1 text-xs text-ash">
                      Review contains spoilers.{" "}
                      <Link href={`/film/${e.slug}`} className="underline">
                        read it on the film page
                      </Link>
                    </p>
                  )}
                </div>
                <span className="num shrink-0 text-lg text-paper">
                  {e.rating !== null ? formatTenths(e.rating) : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
