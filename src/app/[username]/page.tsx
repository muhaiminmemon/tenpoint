import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { diaryEntries, films, friendRequests, users, watchlist } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getRankedLibrary } from "@/lib/library";
import { formatTenths } from "@/lib/format";
import { areFriends, canViewProfile, isBlockedBetween } from "@/lib/social";
import { avatarSrc } from "@/lib/avatar";
import ProfileActions, { type Relationship } from "@/components/ProfileActions";
import Avatar from "@/components/Avatar";
import ProfileTabs from "@/components/ProfileTabs";
import TasteCard from "@/components/TasteCard";
import { getMutualLoves, getTasteProfile } from "@/lib/taste";

export async function generateMetadata(ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  return { title: `@${username}` };
}

export default async function ProfilePage(ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const profile = (
    await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1)
  )[0];
  if (!profile) notFound();

  const viewer = await getSessionUser();
  const isOwner = viewer?.id === profile.id;

  if (viewer && !isOwner && (await isBlockedBetween(viewer.id, profile.id))) notFound();

  const visible = await canViewProfile(viewer, profile);

  let relationship: Relationship = { kind: "none" };
  if (viewer && !isOwner) {
    if (await areFriends(viewer.id, profile.id)) {
      relationship = { kind: "friends" };
    } else {
      const incoming = (
        await db
          .select({ id: friendRequests.id })
          .from(friendRequests)
          .where(and(eq(friendRequests.fromId, profile.id), eq(friendRequests.toId, viewer.id)))
          .limit(1)
      )[0];
      if (incoming) {
        relationship = { kind: "requested_in", requestId: incoming.id };
      } else {
        const outgoing = (
          await db
            .select({ id: friendRequests.id })
            .from(friendRequests)
            .where(and(eq(friendRequests.fromId, viewer.id), eq(friendRequests.toId, profile.id)))
            .limit(1)
        )[0];
        if (outgoing) relationship = { kind: "requested_out" };
      }
    }
  }

  const displayLabel = profile.displayName ?? profile.username;

  if (!visible) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Avatar avatarUrl={avatarSrc(profile.id, profile.avatarUpdatedAt)} name={displayLabel} size={72} className="mx-auto" />
        <h1 className="display mt-3 text-2xl">{displayLabel}</h1>
        <p className="mt-3 text-ash">This profile is private.</p>
        {viewer && !isOwner && (
          <div className="flex justify-center">
            <ProfileActions
              profileId={profile.id}
              profileUsername={profile.username}
              viewerUsername={viewer.username}
              relationship={relationship}
            />
          </div>
        )}
      </div>
    );
  }

  const films_ = await getRankedLibrary(profile.id, { includePrivate: isOwner });
  const rated = films_.filter((f) => f.rating !== null);
  const mean =
    rated.length > 0
      ? formatTenths(Math.round(rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length))
      : null;

  const taste = await getTasteProfile(profile.id, { includePrivate: isOwner });

  // the compare snapshot only appears on someone else's profile
  const viewerTaste =
    viewer && !isOwner ? await getTasteProfile(viewer.id, { includePrivate: true }) : null;
  const viewerMean = viewerTaste?.mean ?? null;
  const mutual = viewer && !isOwner ? await getMutualLoves(viewer.id, profile.id) : [];

  const showDiary = isOwner || profile.showDiaryOnProfile;
  const showWatchlist = isOwner || profile.showWatchlistOnProfile;

  const diaryRows = showDiary
    ? await db
        .select({
          id: diaryEntries.id,
          watchedOn: diaryEntries.watchedOn,
          rating: diaryEntries.rating,
          rewatch: diaryEntries.rewatch,
          title: films.title,
          year: films.year,
          slug: films.slug,
          posterPath: films.posterPath,
        })
        .from(diaryEntries)
        .innerJoin(films, eq(films.id, diaryEntries.filmId))
        .where(
          and(
            eq(diaryEntries.userId, profile.id),
            isOwner ? sql`true` : eq(diaryEntries.private, false),
          ),
        )
        .orderBy(sql`${diaryEntries.watchedOn} desc nulls last`, desc(diaryEntries.createdAt))
        .limit(1000)
    : null;

  const watchlistRows = showWatchlist
    ? await db
        .select({
          filmId: watchlist.filmId,
          title: films.title,
          year: films.year,
          slug: films.slug,
          posterPath: films.posterPath,
          source: watchlist.source,
        })
        .from(watchlist)
        .innerJoin(films, eq(films.id, watchlist.filmId))
        .where(eq(watchlist.userId, profile.id))
        .orderBy(desc(watchlist.createdAt))
    : null;

  return (
    <div>
      <div className="mb-8 flex items-start gap-4">
        <Avatar avatarUrl={avatarSrc(profile.id, profile.avatarUpdatedAt)} name={displayLabel} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="display text-3xl font-medium">{displayLabel}</h1>
          <p className="num mt-1 text-sm text-ash">
            @{profile.username}
            {films_.length ? ` · ${films_.length} films` : ""}
            {mean ? ` · average ${mean}` : ""}
          </p>
          {profile.bio && <p className="mt-3 max-w-lg text-sm text-ash">{profile.bio}</p>}
          {isOwner ? (
            <Link
              href="/settings"
              className="mt-4 inline-block rounded-card border border-seam px-4 py-1.5 text-sm text-paper hover:bg-tray"
            >
              Edit profile
            </Link>
          ) : (
            viewer && (
              <ProfileActions
                profileId={profile.id}
                profileUsername={profile.username}
                viewerUsername={viewer.username}
                relationship={relationship}
              />
            )
          )}
        </div>
      </div>

      <div className="mt-6">
        <TasteCard
          taste={taste}
          compare={
            viewer && !isOwner
              ? {
                  viewerMean,
                  viewerName: "You",
                  theirName: profile.displayName ?? profile.username,
                  mutual,
                }
              : undefined
          }
        />
      </div>

      <ProfileTabs
        films={films_}
        diaryRows={diaryRows}
        watchlistRows={watchlistRows}
        editable={isOwner}
      />
    </div>
  );
}
