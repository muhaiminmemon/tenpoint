import { getSessionUser } from "@/lib/auth";
import { avatarSrc } from "@/lib/avatar";
import { wallPosters } from "@/lib/posters";
import { getGlobalTopRated } from "@/lib/leaderboard";
import { topMoviesOfYear } from "@/lib/tmdb";
import { buildHomeTasteCard, getTasteProfile, markTierSeen } from "@/lib/taste";
import { getRankedLibrary, getRecentViewings } from "@/lib/library";
import { friendIdsOf } from "@/lib/social";
import { recordHeldVariant } from "@/lib/variant-history";
import TopRatedBoard from "@/components/TopRatedBoard";
import HomeLayout from "@/components/HomeLayout";
import LandingMarquee from "@/components/LandingMarquee";
import { type QuickRateFilm } from "@/components/QuickRateDeck";

export default async function Home() {
  const user = await getSessionUser();

  if (user) {
    const [topRated, taste, library, friendIds, recentViewings] = await Promise.all([
      getGlobalTopRated(10),
      getTasteProfile(user.id, { includePrivate: true }),
      // Read at the season grain, not collapsed: nothing on this page lists
      // the library, and the card that consumes it counts a season as a
      // season on purpose.
      getRankedLibrary(user.id, { includePrivate: true, collapseSeries: false }),
      friendIdsOf(user.id),
      getRecentViewings(user.id, 6),
    ]);
    const tasteCard = await buildHomeTasteCard(user.id, taste, library, friendIds, {
      includePrivate: true,
    });

    // Recording the held finish belongs to the owner's own visit, not to the
    // builder: the profile renders the same card for visitors, and a write
    // inside the builder would let a stranger's page load stamp a finish into
    // this account's binder history.
    if (tasteCard.variant.name) await recordHeldVariant(user.id, tasteCard.variant.name);

    // Arriving at the home page is what counts as seeing it, since the card is
    // right here. Storing the tier rather than a timestamp means a later rise
    // flags again on its own.
    if (tasteCard.tier.name !== user.tierSeen) await markTierSeen(user.id, tasteCard.tier.name);

    const displayLabel = user.displayName ?? user.username;
    const hasFriend = friendIds.length > 0;

    let quickRateFilms: QuickRateFilm[] = [];
    try {
      const movies = await topMoviesOfYear(new Date().getFullYear());
      quickRateFilms = movies
        .filter((m) => m.poster_path)
        .slice(0, 24)
        .map((m) => ({
          tmdbId: m.id,
          title: m.title,
          year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
          posterPath: m.poster_path ?? null,
        }));
    } catch {
      // no TMDB key, rate limited, or offline — the deck just stays empty
    }

    return (
      <>
        <HomeLayout
          name={displayLabel}
          username={user.username}
          displayName={displayLabel}
          avatarUrl={avatarSrc(user.id, user.avatarUpdatedAt)}
          userId={user.id}
          memberNumber={user.memberNumber}
          memberSince={new Date(user.createdAt).getFullYear()}
          taste={tasteCard}
          hasFriend={hasFriend}
          quickRateFilms={quickRateFilms}
          recentViewings={recentViewings}
        />
        <div className="pb-6">
          <TopRatedBoard films={topRated} />
        </div>
      </>
    );
  }

  const posters = await wallPosters(12);

  // The comparison lives in the copy, never in the name: describing what we're
  // an alternative to is ordinary and protected, and naming ourselves after
  // them would not have been.
  return <LandingMarquee posters={posters} />;
}
