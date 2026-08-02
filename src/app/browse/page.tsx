import Link from "next/link";
import BrowseFilters from "@/components/BrowseFilters";
import FilmRail from "@/components/FilmRail";
import PosterTile from "@/components/PosterTile";
import {
  BROWSE_GENRES,
  EMPTY_FILTERS,
  describeFilters,
  filtersToQuery,
  isFiltered,
  parseFilters,
} from "@/lib/browse";
import { runBrowse } from "@/lib/browse-query";
import { nowPlaying, trendingThisWeek, type TmdbMovie } from "@/lib/tmdb";

export const metadata = { title: "Browse" };

/**
 * The catalogue: everything TMDB knows, narrowed by asking.
 *
 * Two states, not two pages. Arriving with no question shows named rails —
 * what is on now, what people are watching, the canon — because an unfiltered
 * grid of every film ever made answers nothing. Touching any control turns the
 * page into a grid of that query. The filters stay put across both, so nobody
 * has to find them twice.
 *
 * Server-rendered from the URL, so a filtered view is a link and the results
 * arrive with the HTML. TMDB responses are cached for an hour upstream, and
 * posters are served from our own origin with a year's cache, so scrolling
 * this page is close to free.
 */
export default async function BrowsePage(ctx: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await ctx.searchParams);
  const filtered = isFiltered(filters);

  return (
    <div className="pb-10">
      <header className="mb-7">
        <h1 className="display text-[32px] leading-none text-paper">Browse</h1>
        <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-ash">
          Every film TMDB has a record of. Nothing here is ranked by what anyone on this site
          thinks. Open one to rate it and it joins your library.
        </p>
      </header>

      <div className="sticky top-0 z-10 -mx-4 border-b border-seam bg-void/95 px-4 py-4 backdrop-blur">
        <BrowseFilters filters={filters} />
      </div>

      {filtered ? <Grid filters={filters} /> : <Rails />}
    </div>
  );
}

/** The answer to a question someone actually asked. */
async function Grid({ filters }: { filters: ReturnType<typeof parseFilters> }) {
  let page;
  try {
    page = await runBrowse(filters);
  } catch {
    return (
      <p className="mt-10 text-sm text-ash">
        Couldn&apos;t reach the film database just now. The filters are still in the address bar,
        so a refresh will try again.
      </p>
    );
  }

  if (page.results.length === 0) {
    // Two different nothings. A TMDB query that returns nothing was narrowed
    // too far; a critic ranking that returns nothing usually just has not been
    // filled in yet, and telling someone to widen their filters would send
    // them looking for a problem they do not have.
    const leaderboard = filters.source !== "tmdb";
    return (
      <div className="mt-10 max-w-[48ch]">
        <p className="display text-[17px] text-paper">Nothing matches that.</p>
        <p className="mt-2 text-sm leading-relaxed text-ash">
          {leaderboard ? (
            <>
              Critic rankings only cover films whose scores we already hold, which is a much
              smaller set than TMDB&apos;s whole index and grows as the catalogue fills in.
              Switching &ldquo;Rated by&rdquo; back to the TMDB audience searches everything.
            </>
          ) : (
            <>
              The rating floor is the usual culprit: asking for 9.0 and up inside a single decade
              leaves very few films standing. Try widening one thing at a time.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[12.5px] text-ash">{describeFilters(filters)}</p>
        <p className="num text-[12.5px] text-dim">
          {page.totalResults.toLocaleString()} films
        </p>
      </div>

      <ul className="mt-4 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
        {page.results.map((m) => (
          <li key={m.id}>
            <PosterTile movie={m} />
          </li>
        ))}
      </ul>

      <Pager filters={filters} page={page.page} totalPages={page.totalPages} />
    </>
  );
}

/**
 * Pages rather than infinite scroll: a grid you can link into the middle of,
 * and one that never traps a reader who wants to reach the footer.
 */
function Pager({
  filters,
  page,
  totalPages,
}: {
  filters: ReturnType<typeof parseFilters>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const step = (n: number) => `/browse${filtersToQuery({ ...filters, page: n })}`;

  return (
    <nav className="mt-10 flex items-center justify-between gap-4" aria-label="Pagination">
      {page > 1 ? (
        <Link
          href={step(page - 1)}
          className="rounded-card border border-seam px-4 py-2 text-sm text-ash transition-colors hover:border-dim hover:text-paper"
        >
          &larr; Previous
        </Link>
      ) : (
        <span />
      )}

      <span className="num text-[12.5px] text-dim">
        {page} of {totalPages.toLocaleString()}
      </span>

      {page < totalPages ? (
        <Link
          href={step(page + 1)}
          className="rounded-card border border-seam px-4 py-2 text-sm text-ash transition-colors hover:border-dim hover:text-paper"
        >
          Next &rarr;
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** The unfiltered view: named shelves instead of an undifferentiated wall. */
async function Rails() {
  // One failure should cost one rail, not the page.
  const settle = async (p: Promise<TmdbMovie[]>) => p.catch(() => [] as TmdbMovie[]);
  const grab = (q: Partial<Parameters<typeof runBrowse>[0]>) =>
    runBrowse({ ...EMPTY_FILTERS, ...q })
      .then((r) => r.results)
      .catch(() => [] as TmdbMovie[]);

  const [inCinemas, trending, acclaimed, japanese, shortFilms] = await Promise.all([
    settle(nowPlaying()),
    settle(trendingThisWeek()),
    grab({ sort: "rated" }),
    grab({ sort: "rated", language: "ja" }),
    grab({ sort: "rated", runtime: "short" }),
  ]);

  const link = (q: Parameters<typeof filtersToQuery>[0]) => `/browse${filtersToQuery(q)}`;

  return (
    <div className="mt-8 flex flex-col gap-11">
      <FilmRail title="In cinemas now" note="Playing this week" movies={inCinemas} />
      <FilmRail title="Trending" note="What people are looking at right now" movies={trending} />
      <FilmRail
        title="The canon"
        note="Highest rated of all time, with enough votes to mean it"
        movies={acclaimed}
        href={link({ sort: "rated" })}
      />
      <FilmRail
        title="Japanese cinema"
        note="The best regarded, in the original language"
        movies={japanese}
        href={link({ sort: "rated", language: "ja" })}
      />
      <FilmRail
        title="Under ninety minutes"
        note="Everything that fits in an evening"
        movies={shortFilms}
        href={link({ sort: "rated", runtime: "short" })}
      />

      <section>
        <h2 className="display mb-3 text-[19px] leading-none text-paper">Every genre</h2>
        <ul className="flex flex-wrap gap-2">
          {BROWSE_GENRES.map((g) => (
            <li key={g.id}>
              <Link
                href={link({ genre: g.id })}
                className="inline-block rounded-full border border-seam px-3.5 py-1.5 text-[12.5px] text-ash transition-colors hover:border-dim hover:text-paper"
              >
                {g.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
