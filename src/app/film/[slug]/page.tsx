import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { diaryEntries, films, listItems, listMembers, lists, watchlist } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { hydrateFilm, isUnreleased } from "@/lib/films";
import { criticScores } from "@/lib/omdb";
import CriticScores from "@/components/CriticScores";
import PosterImg from "@/components/PosterImg";
import FilmPanel from "@/components/FilmPanel";
import FilmStickyHeader from "@/components/FilmStickyHeader";
import RewatchTimeline from "@/components/RewatchTimeline";
import ReviewsSection from "@/components/ReviewsSection";
import SimilarRail from "@/components/SimilarRail";
import CastList from "@/components/CastList";
import { personHref } from "@/lib/browse";
import { similarTo } from "@/lib/similar";
import { shows } from "@/db/schema";

export async function generateMetadata(ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const film = (await db.select().from(films).where(eq(films.slug, slug)).limit(1))[0];
  return { title: film ? `${film.title}${film.year ? ` (${film.year})` : ""}` : "Film" };
}

export default async function FilmPage(ctx: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reviews?: string }>;
}) {
  const { slug } = await ctx.params;
  const { reviews: reviewsParam } = await ctx.searchParams;
  const reviewsTab = reviewsParam === "recent" ? ("recent" as const) : ("friends" as const);
  let film = (await db.select().from(films).where(eq(films.slug, slug)).limit(1))[0];
  if (!film) notFound();

  /**
   * A whole series belongs on the show page, not here.
   *
   * The row standing for a series lives in `films` so that the diary, lists,
   * the watchlist and the recommender need know nothing about shows, and it
   * carries the show's own slug. That means every link built the ordinary way,
   * `/film/${'${slug}'}`, from the watchlist queue, a list, the feed, a profile,
   * quietly landed on a film page describing a series: no seasons, no way to
   * rate one, and a second page competing with /show for the same thing.
   *
   * Redirecting here fixes all of those at once, and any future caller too,
   * which is the point: fifteen link sites cannot each be trusted to remember
   * what kind of row they are holding.
   */
  if (film.kind === "show") redirect(`/show/${film.slug}`);

  film = await hydrateFilm(film);
  // Cached on the film row and only fetched from a film's own page: the free
  // tier is 1,000 requests a day, which a grid would spend in an afternoon.
  const scores = await criticScores(film);

  const user = await getSessionUser();
  const entries = user
    ? await db
        .select()
        .from(diaryEntries)
        .where(and(eq(diaryEntries.userId, user.id), eq(diaryEntries.filmId, film.id)))
        .orderBy(sql`${diaryEntries.watchedOn} desc nulls last`, desc(diaryEntries.createdAt))
    : [];

  const ratedSorted = entries.filter((e) => e.rating !== null);
  const currentRated = ratedSorted[0] ?? null;

  const timelinePoints = entries
    .filter((e): e is typeof e & { watchedOn: string; rating: number } =>
      Boolean(e.watchedOn && e.rating !== null),
    )
    .map((e) => ({ watchedOn: e.watchedOn, rating: e.rating }))
    .sort((a, b) => a.watchedOn.localeCompare(b.watchedOn));

  const wlRow = user
    ? (
        await db
          .select()
          .from(watchlist)
          .where(and(eq(watchlist.userId, user.id), eq(watchlist.filmId, film.id)))
          .limit(1)
      )[0]
    : undefined;

  let editableLists: { id: string; title: string; hasFilm: boolean }[] = [];
  if (user) {
    const memberships = await db
      .select({ listId: listMembers.listId })
      .from(listMembers)
      .where(
        and(eq(listMembers.userId, user.id), inArray(listMembers.role, ["owner", "editor"])),
      );
    if (memberships.length) {
      const listIds = memberships.map((m) => m.listId);
      const rows = await db
        .select({ id: lists.id, title: lists.title })
        .from(lists)
        .where(inArray(lists.id, listIds))
        .orderBy(asc(lists.title));
      // which of them already hold this film, so the panel can say so
      // rather than offering an "add" that silently does nothing
      const containing = await db
        .select({ listId: listItems.listId })
        .from(listItems)
        .where(and(inArray(listItems.listId, listIds), eq(listItems.filmId, film.id)));
      const has = new Set(containing.map((c) => c.listId));
      editableLists = rows.map((r) => ({ ...r, hasFilm: has.has(r.id) }));
    }
  }

  // A season belongs to something, and the page it sits on is the same page a
  // film gets, so the only thing that has to change is that it names its show
  // and can get back to it.
  const parent =
    film.kind === "season" && film.showId
      ? (await db.select().from(shows).where(eq(shows.id, film.showId)).limit(1))[0]
      : null;

  const meta = [film.runtime ? `${film.runtime} min` : null, film.genres?.[0]]
    .filter(Boolean)
    .join(" · ");

  // Split on the comma because a co-directed film stores both names in one
  // field, and a single link covering two people goes to neither.
  const directors = film.director?.split(", ").map((d) => d.trim()).filter(Boolean) ?? [];
  const rest = [film.runtime ? `${film.runtime} min` : null, film.genres?.join(", ")].filter(
    (x): x is string => Boolean(x),
  );

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <FilmStickyHeader
        title={film.title}
        meta={[film.year, meta].filter(Boolean).join(" · ")}
        rating={currentRated?.rating ?? null}
      />
      <div className="w-40 shrink-0 sm:w-52">
        <PosterImg
          posterPath={film.posterPath}
          title={film.title}
          size="w500"
          sizes="(max-width: 640px) 160px, 208px"
          className="fade-up aspect-[2/3] w-full rounded-card"
          priority
        />
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="display text-3xl font-medium leading-tight">
          {parent ? film.title.replace(`${parent.name}: `, "") : film.title}{" "}
          {film.year && <span className="num text-xl font-normal text-ash">{film.year}</span>}
        </h1>
        {/* The director is the same door as any face in the cast list, so it
            opens the same way rather than sitting here as dead text. */}
        <p className="mt-1 text-sm text-ash">
          {parent && (
            <>
              <Link href={`/show/${parent.slug}`} className="text-paper hover:underline">
                {parent.name}
              </Link>
              {(directors.length > 0 || rest.length > 0) && " · "}
            </>
          )}
          {directors.map((name, i) => (
            <span key={name}>
              {i > 0 && ", "}
              <Link href={personHref(name, parent ? "show" : "movie")} className="hover:text-paper hover:underline">
                {name}
              </Link>
            </span>
          ))}
          {rest.map((part, i) => (
            // The separator belongs to the part that follows it, so a film with
            // no director does not open on a floating middot.
            <span key={part}>
              {i === 0 && directors.length === 0 && !parent ? part : ` · ${part}`}
            </span>
          ))}
        </p>
        {film.overview && <p className="mt-4 max-w-xl text-sm text-ash">{film.overview}</p>}
        <CastList names={film.castNames ?? []} media={parent ? "show" : "movie"} />

        <div className="mt-8 space-y-8">
          <CriticScores scores={scores} />
          {timelinePoints.length >= 2 && <RewatchTimeline points={timelinePoints} />}
          {user ? (
            <FilmPanel
              unreleased={isUnreleased(film)}
              film={{
                id: film.id,
                title: film.title,
                year: film.year,
                director: film.director,
                posterPath: film.posterPath,
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
          ) : (
            <p className="text-ash">
              <Link href="/login" className="text-paper underline">
                Sign in
              </Link>{" "}
              to log and rate this film.
            </p>
          )}
          <ReviewsSection filmId={film.id} filmSlug={film.slug} viewer={user} tab={reviewsTab} />
          <SimilarRail {...(await similarTo(film.id, user?.id ?? null))} />
        </div>
      </div>
    </div>
  );
}
