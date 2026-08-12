import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { films, shows, watchlist } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isUnreleased } from "@/lib/films";
import WatchlistShelf, { type ShelfItem } from "@/components/WatchlistShelf";

export const metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const rows = await db
    .select({
      filmId: watchlist.filmId,
      addedAt: watchlist.createdAt,
      title: films.title,
      year: films.year,
      slug: films.slug,
      director: films.director,
      posterPath: films.posterPath,
      runtime: films.runtime,
      releaseDate: films.releaseDate,
      // Television is a row in `films`, not a separate table, so a queued
      // season arrives here looking exactly like a film until these three
      // columns are read.
      kind: films.kind,
      seasonNumber: films.seasonNumber,
      showName: shows.name,
      showSlug: shows.slug,
    })
    .from(watchlist)
    .innerJoin(films, eq(films.id, watchlist.filmId))
    .leftJoin(shows, eq(shows.id, films.showId))
    .where(eq(watchlist.userId, user.id))
    // the order you dragged into, newest-added first among untouched rows
    .orderBy(asc(watchlist.position), desc(watchlist.createdAt));

  /**
   * Naming and routing happen here, once, on the server.
   *
   * A season's `title` is its own — "Season 2" — which says nothing on a page
   * that is not already inside a series, and every row used to link to
   * `/film/{slug}` whatever it was, so a queued season pointed at a route that
   * does not serve it. The two facts a tile needs are what this thing is called
   * and where it goes; both are derived from `kind` and neither belongs in the
   * client.
   */
  const items: ShelfItem[] = rows.map((r) => {
    const isSeason = r.kind === "season";
    const isSeries = r.kind === "show";
    const showLabel = r.showName ?? r.title;
    return {
      filmId: r.filmId,
      href:
        (isSeason || isSeries) && r.showSlug ? `/show/${r.showSlug}` : `/film/${r.slug}`,
      title: isSeason || isSeries ? showLabel : r.title,
      // Only a season carries a second line of identity; a whole series is
      // named by the badge instead, so it is not "Severance · Severance".
      part: isSeason
        ? r.seasonNumber === 0
          ? "Specials"
          : `Season ${r.seasonNumber ?? "?"}`
        : null,
      kind: isSeason ? "season" : isSeries ? "series" : "film",
      year: r.year,
      director: r.director,
      posterPath: r.posterPath,
      runtime: r.runtime,
      addedAt: r.addedAt.toISOString(),
      unreleased: isUnreleased({ releaseDate: r.releaseDate }),
    };
  });

  return <WatchlistShelf items={items} />;
}
