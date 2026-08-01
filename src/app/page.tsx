import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { avatarSrc } from "@/lib/avatar";
import { APP_POSITIONING } from "@/lib/brand";
import { wallPosters } from "@/lib/posters";
import { getGlobalTopRated } from "@/lib/leaderboard";
import { topMoviesOfYear } from "@/lib/tmdb";
import { buildHomeTasteCard, getTasteProfile } from "@/lib/taste";
import { getRankedLibrary, getRecentViewings } from "@/lib/library";
import { friendIdsOf } from "@/lib/social";
import { formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import TopRatedBoard from "@/components/TopRatedBoard";
import HomeLayout from "@/components/HomeLayout";
import { type QuickRateFilm } from "@/components/QuickRateDeck";

const PROMISES: { lead: string; rest: string }[] = [
  {
    lead: "Bring your Letterboxd history.",
    rest: "Import, preview every row, undo anytime.",
  },
  {
    lead: "Keep your history honest.",
    rest: "Rewatches never overwrite old ratings.",
  },
  {
    lead: "Your data stays yours.",
    rest: "Full export, free forever.",
  },
];

export default async function Home() {
  const user = await getSessionUser();

  if (user) {
    const [topRated, taste, library, friendIds, recentViewings] = await Promise.all([
      getGlobalTopRated(10),
      getTasteProfile(user.id, { includePrivate: true }),
      getRankedLibrary(user.id, { includePrivate: true }),
      friendIdsOf(user.id),
      getRecentViewings(user.id, 6),
    ]);
    const tasteCard = await buildHomeTasteCard(user.id, taste, library, friendIds, {
      includePrivate: true,
    });

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

  return (
    <div className="py-6">
      <div className="overflow-hidden rounded-xl border border-seam bg-carbon">
        <div className="grid md:grid-cols-[1fr_0.92fr]">
          <div className="p-8 sm:p-10 md:py-13">
            {/* The comparison lives in the copy, never in the name: describing
                what we're an alternative to is ordinary and protected, and
                naming ourselves after them would not have been. */}
            <p className="display mb-3 text-[13px] uppercase tracking-[0.14em] text-beam">
              {APP_POSITIONING}
            </p>
            <h1 className="display text-[38px] font-medium leading-[1.02] text-paper sm:text-[44px]">
              Rate films
              <br />
              properly.
            </h1>
            <p className="mt-5 max-w-[360px] text-base leading-relaxed text-ash">
              A film diary on a 1.0 to 10.0 scale, in tenths. Forty films don&apos;t share four
              stars here. <span className="num text-paper">8.7</span> and{" "}
              <span className="num text-paper">8.2</span> are different opinions.
            </p>

            <ul className="my-7 flex flex-col gap-3.5">
              {PROMISES.map((p) => (
                <li key={p.lead} className="text-sm">
                  <span className="text-paper">{p.lead}</span>{" "}
                  <span className="text-ash">{p.rest}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-4.5">
              <Link
                href="/signup"
                className="display rounded-card bg-paper px-5.5 py-2.5 text-[15px] font-medium text-carbon hover:bg-white"
              >
                Create account
              </Link>
              <Link href="/login" className="text-[15px] text-ash hover:text-paper">
                Sign in
              </Link>
            </div>
          </div>

          {/* the wall does the persuading; ratings shown are real community means */}
          {posters.length > 0 && (
            <div className="relative hidden overflow-hidden border-l border-seam bg-[#0f0f12] p-5.5 md:block">
              <h2 className="sr-only">The biggest films of {new Date().getFullYear()}</h2>
              <div className="grid grid-cols-4 gap-2">
                {posters.map((p, i) => {
                  const url = posterUrl(p.posterPath, "w154");
                  return (
                    <div
                      key={i}
                      className="relative overflow-hidden rounded-[5px] border border-seam bg-tray"
                      style={{ aspectRatio: "2/3" }}
                    >
                      {url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={p.title}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      )}
                      {p.rating !== null && (
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(10,10,12,.9)] to-transparent px-1.5 py-0.5">
                          <span className={`num text-[11px] ${ratingColor(p.rating)}`}>
                            {formatTenths(p.rating)}
                          </span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0f0f12] to-transparent"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
