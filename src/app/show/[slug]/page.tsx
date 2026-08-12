import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { diaryEntries, listItems, listMembers, lists, watchlist } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { loadShow, derivedScore, showRow } from "@/lib/shows";
import { formatTenths, ratingColor } from "@/lib/format";
import { personHref } from "@/lib/browse";
import PosterImg from "@/components/PosterImg";
import SeasonRater from "@/components/SeasonRater";
import FilmPanel from "@/components/FilmPanel";
import ReviewsSection from "@/components/ReviewsSection";
import CastList from "@/components/CastList";

export async function generateMetadata(ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const found = await loadShow(slug);
  return { title: found ? found.show.name : "Show" };
}

const FORM_LABEL: Record<string, string> = {
  anime: "Anime",
  animation: "Animation",
  live_action: "Live action",
};

/**
 * A series, understood through its seasons.
 *
 * The page is deliberately the film page's twin: same poster block, same
 * credits line, same cast list, same reviews below. What is different is the
 * middle, and only the middle. A show is not a film with extra tabs, it is a
 * run of things you rated, so the run is the content and everything else is
 * the same furniture in the same places.
 *
 * There is one score and it is derived. It never appears as something to set,
 * and it is labelled as the average it is, because a second editable number
 * for the same thing would be two opinions allowed to disagree.
 */
export default async function ShowPage(ctx: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reviews?: string }>;
}) {
  const { slug } = await ctx.params;
  const { reviews: reviewsParam } = await ctx.searchParams;
  const reviewsTab = reviewsParam === "recent" ? "recent" : "friends";
  const found = await loadShow(slug);
  if (!found) notFound();
  const { show, seasons } = found;

  // The row that stands for the whole series. Rating it is rating a row, so
  // the ordinary panel works on it untouched: log, rate, review, watchlist,
  // lists, rewatches, all of it.
  const whole = await showRow(show.id);

  const user = await getSessionUser();

  const entries = user && whole
    ? await db
        .select()
        .from(diaryEntries)
        .where(and(eq(diaryEntries.userId, user.id), eq(diaryEntries.filmId, whole.id)))
        .orderBy(sql`${diaryEntries.watchedOn} desc nulls last`, desc(diaryEntries.createdAt))
    : [];

  const wlRow = user && whole
    ? (
        await db
          .select()
          .from(watchlist)
          .where(and(eq(watchlist.userId, user.id), eq(watchlist.filmId, whole.id)))
          .limit(1)
      )[0]
    : undefined;

  let editableLists: { id: string; title: string; hasFilm: boolean }[] = [];
  if (user && whole) {
    const memberships = await db
      .select({ listId: listMembers.listId })
      .from(listMembers)
      .where(and(eq(listMembers.userId, user.id), inArray(listMembers.role, ["owner", "editor"])));
    if (memberships.length) {
      const listIds = memberships.map((m) => m.listId);
      const rows = await db
        .select({ id: lists.id, title: lists.title })
        .from(lists)
        .where(inArray(lists.id, listIds))
        .orderBy(asc(lists.title));
      const containing = await db
        .select({ listId: listItems.listId })
        .from(listItems)
        .where(and(inArray(listItems.listId, listIds), eq(listItems.filmId, whole.id)));
      const has = new Set(containing.map((c) => c.listId));
      editableLists = rows.map((r) => ({ ...r, hasFilm: has.has(r.id) }));
    }
  }

  const mine = user && seasons.length
    ? await db
        .select({ id: diaryEntries.id, filmId: diaryEntries.filmId, rating: diaryEntries.rating })
        .from(diaryEntries)
        .where(
          and(
            eq(diaryEntries.userId, user.id),
            inArray(diaryEntries.filmId, seasons.map((s) => s.id)),
            sql`${diaryEntries.rating} is not null`,
          ),
        )
        .orderBy(desc(diaryEntries.createdAt))
    : [];

  // The most recent rating per season, matching how a rating is read everywhere
  // else: a rewatch that was not rated never erases what somebody last thought.
  // Which seasons are already on the watchlist, so a row can offer to add or
  // remove one. Seasons are ordinary film rows, so the endpoint already
  // accepted them; there was simply no control anywhere that sent one.
  const queued = user && seasons.length
    ? new Set(
        (
          await db
            .select({ filmId: watchlist.filmId })
            .from(watchlist)
            .where(
              and(
                eq(watchlist.userId, user.id),
                inArray(watchlist.filmId, seasons.map((s) => s.id)),
              ),
            )
        ).map((r) => r.filmId),
      )
    : new Set<string>();

  const rated = new Map<string, { rating: number; entryId: string }>();
  for (const row of mine) {
    // The id travels with it so the row can offer to remove the rating. Films
    // have had that since the beginning; seasons had no way to undo one.
    if (row.rating !== null && !rated.has(row.filmId))
      rated.set(row.filmId, { rating: row.rating, entryId: row.id });
  }
  const score = derivedScore([...rated.values()].map((r) => r.rating));
  const today = new Date().toISOString().slice(0, 10);

  /**
   * Where this viewer stands on the seasons, said in the page's own terms.
   *
   * A season that has not aired cannot be rated and must not count against
   * somebody: a running show with next season already listed would otherwise
   * never read as caught up, however completely they have watched it.
   */
  const airedSeasons = seasons.filter((s) => !(s.releaseDate && s.releaseDate > today));
  const ratedAired = airedSeasons.filter((s) => rated.has(s.id)).length;
  const throughAllSeasons = airedSeasons.length > 0 && ratedAired === airedSeasons.length;
  const wholeRated = entries.some((e) => e.rating !== null);
  // Cancelled counts as ended, the same way the library reads it: telling
  // somebody they are merely "caught up" on a show that stopped in 2006 is
  // just wrong.
  const ended = ["Ended", "Canceled", "Cancelled"].includes(show.status ?? "");
  /**
   * One season is not a season list.
   *
   * Offering "rate by seasons · 1" on a miniseries is asking somebody to open
   * a list to do the thing the panel above already does. The rater still
   * appears if a season here is already rated, because hiding it would strand
   * a rating with no way to change or remove it.
   */
  const showSeasonRater = seasons.length > 1 || seasons.some((s) => rated.has(s.id));

  const run = [show.firstAirYear, show.lastAirYear && show.lastAirYear !== show.firstAirYear ? show.lastAirYear : null]
    .filter(Boolean)
    .join(" to ");
  const meta = [
    FORM_LABEL[show.form ?? ""] ?? null,
    show.genres?.slice(0, 3).join(", ") || null,
    show.status === "Returning Series" ? "Still running" : show.status === "Ended" ? "Ended" : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <div className="w-40 shrink-0 sm:w-52">
        <PosterImg
          posterPath={show.posterPath}
          title={show.name}
          size="w500"
          sizes="(max-width: 640px) 160px, 208px"
          className="fade-up aspect-[2/3] w-full rounded-card"
          priority
        />
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="display text-3xl font-medium leading-tight">
          {show.name} {run && <span className="num text-xl font-normal text-ash">{run}</span>}
        </h1>
        <p className="mt-1 text-sm text-ash">
          {show.creators?.length ? (
            <>
              {show.creators.slice(0, 2).map((name, i) => (
                <span key={name}>
                  {i > 0 && ", "}
                  <Link href={personHref(name, "show")} className="hover:text-paper hover:underline">
                    {name}
                  </Link>
                </span>
              ))}
              {meta.length > 0 && " · "}
            </>
          ) : null}
          {meta.join(" · ")}
        </p>
        {show.overview && <p className="mt-4 max-w-xl text-sm text-ash">{show.overview}</p>}
        <CastList names={show.castNames ?? []} media="show" />

        {user && whole ? (
          <div className="mt-8">
            {/* One rating for the whole thing, which is what most people have.
                The panel is the same one a film gets, so logging, reviewing,
                the watchlist, lists and rewatches all behave identically. */}
            <FilmPanel
              film={{
                id: whole.id,
                title: show.name,
                year: show.firstAirYear,
                director: show.creators?.[0] ?? null,
                posterPath: show.posterPath,
              }}
              entries={entries.map((e) => ({
                id: e.id,
                watchedOn: e.watchedOn,
                rating: e.rating,
                rewatch: e.rewatch,
                review: e.review,
                spoiler: e.spoiler,
                private: e.private,
                createdAt: e.createdAt.toISOString(),
              }))}
              inWatchlist={Boolean(wlRow)}
              watchlistSource={wlRow?.source ?? null}
              lists={editableLists}
            />

            {showSeasonRater && (
              <SeasonRater
                showName={show.name}
                open={rated.size > 0}
                seasons={seasons.map((s) => ({
                  id: s.id,
                  slug: s.slug,
                  label: s.title.replace(`${show.name}: `, ""),
                  episodes: s.episodeCount,
                  year: s.year,
                  posterPath: s.posterPath,
                  audience: s.audienceRating,
                  rating: rated.get(s.id)?.rating ?? null,
                  entryId: rated.get(s.id)?.entryId ?? null,
                  inWatchlist: queued.has(s.id),
                  unaired: Boolean(s.releaseDate && s.releaseDate > today),
                }))}
              />
            )}

            {/* One season, so there is nothing to break into seasons. */}
            {!showSeasonRater && seasons.length === 1 && (
              <p className="mt-4 text-[13px] text-ash">
                {show.name} has one season, so the rating above is the whole show.
              </p>
            )}

            {/*
             * Rating every season is finishing the series, and nothing said so.
             *
             * Somebody who works through nine seasons one at a time has made a
             * complete statement about the show, and the page went on offering
             * the same panel as if they had done nothing. It also never
             * explained what the whole-series rating is *for* once the seasons
             * are all in, which is the question that arrives at exactly this
             * moment: it is one verdict on the show, not the average of the
             * parts, and the two are stored and read separately everywhere.
             */}
            {showSeasonRater && throughAllSeasons && (
              <div className="mt-4 rounded-card border border-seam bg-tray p-3.5">
                <p className="text-[13px] text-paper">
                  {ended
                    ? `All ${airedSeasons.length} seasons rated. You finished ${show.name} season by season.`
                    : `Every season so far rated. You are caught up on ${show.name}.`}
                </p>
                {!wholeRated && (
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ash">
                    Give the whole show a rating too? The panel above is one verdict on the
                    series itself. It is kept apart from the average of its seasons, so it
                    replaces nothing you have said here.
                  </p>
                )}
              </div>
            )}

            {score !== null && (
              <p className="mt-4 text-[12px] text-ash">
                Your seasons average{" "}
                <span className={`num text-[15px] ${ratingColor(score)}`}>{formatTenths(score)}</span>
                {show.voteAverage !== null && (
                  <span className="text-dim">
                    {"  ·  "}Audience{" "}
                    <span className="num text-[15px] text-ash">{formatTenths(show.voteAverage)}</span>
                  </span>
                )}
              </p>
            )}
          </div>
        ) : (
          <section aria-labelledby="seasons" className="mt-8">
            <div className="flex items-baseline justify-between gap-4 border-b border-edge pb-2.5">
              <h2 id="seasons" className="display text-[19px] text-paper">
                Seasons
              </h2>
              {show.voteAverage !== null && (
                <span className="text-[12px] text-dim">
                  Audience{" "}
                  <span className="num text-[15px] text-ash">{formatTenths(show.voteAverage)}</span>
                </span>
              )}
            </div>
            <ul className="mt-1">
              {seasons.map((s) => (
                <li key={s.id} className="flex items-center gap-4 border-b border-seam py-3.5 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-paper">
                      {s.title.replace(`${show.name}: `, "")}
                    </span>
                    <span className="num mt-0.5 block text-[12px] text-ash">
                      {[s.year, s.episodeCount ? `${s.episodeCount} episodes` : null]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </span>
                  </span>
                  {s.audienceRating !== null && (
                    <span className="num shrink-0 text-[13px] text-dim">
                      {formatTenths(s.audienceRating)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-ash">
              <Link href="/login" className="text-paper underline">
                Sign in
              </Link>{" "}
              to rate this, or rate it a season at a time.
            </p>
          </section>
        )}

        {/* Who has been watching this, at either grain.
            Television opinion lives on the seasons: almost nobody rates the
            whole-series row, so a feed keyed to the one row this page is named
            after showed an empty section on every series in the catalogue.
            Reading the series and its seasons together is the only way this
            page can answer the question the film page answers. */}
        <div className="mt-10">
          <ReviewsSection
            filmIds={[whole?.id, ...seasons.map((s) => s.id)].filter(
              (id): id is string => Boolean(id),
            )}
            basePath={`/show/${show.slug}`}
            title={show.name}
            viewer={user}
            tab={reviewsTab}
          />
        </div>
      </div>
    </div>
  );
}
