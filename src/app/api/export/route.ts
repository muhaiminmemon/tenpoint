import { NextResponse } from "next/server";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { diaryEntries, films, listItems, listMembers, lists, watchlist } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { formatTenths } from "@/lib/library";
import { formatStars } from "@/lib/letterboxd";
import { APP_SLUG } from "@/lib/brand";

/** RFC 4180: quote everything, double any embedded quote. */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return `"${String(value).replace(/"/g, '""')}"`;
}

function csvRows(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/**
 * Letterboxd's importer reads Title/Year/Rating/WatchedDate/Rewatch/Review/Tags,
 * with `Rating` in half-star steps from 0.5 to 5. Our tenths are twice their
 * stars, so 8.7 rounds to 4.5★. See `formatStars`.
 */
async function letterboxdDiaryCsv(userId: string, username: string) {
  const rows = await db
    .select({
      title: films.title,
      year: films.year,
      tmdbId: films.tmdbId,
      watchedOn: diaryEntries.watchedOn,
      rating: diaryEntries.rating,
      review: diaryEntries.review,
      rewatch: diaryEntries.rewatch,
      createdAt: diaryEntries.createdAt,
    })
    .from(diaryEntries)
    .innerJoin(films, eq(films.id, diaryEntries.filmId))
    // private entries are yours alone, and never leave in a file meant for upload
    .where(sql`${diaryEntries.userId} = ${userId} and ${diaryEntries.private} = false`)
    .orderBy(sql`${diaryEntries.watchedOn} asc nulls last`, asc(diaryEntries.createdAt));

  const header = [
    "Title",
    "Year",
    "tmdbID",
    "Rating",
    "WatchedDate",
    "Rewatch",
    "Review",
    "Tags",
  ];
  const body = rows.map((r) => [
    r.title,
    r.year,
    r.tmdbId,
    r.rating === null ? "" : formatStars(r.rating),
    r.watchedOn ?? "",
    r.rewatch ? "true" : "false",
    r.review ?? "",
    APP_SLUG,
  ]);

  return new NextResponse(csvRows([header, ...body]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${APP_SLUG}-${username}-letterboxd-diary.csv"`,
    },
  });
}

/** Watchlist as its own Letterboxd-importable file. */
async function letterboxdWatchlistCsv(userId: string, username: string) {
  const rows = await db
    .select({ title: films.title, year: films.year, tmdbId: films.tmdbId })
    .from(watchlist)
    .innerJoin(films, eq(films.id, watchlist.filmId))
    .where(eq(watchlist.userId, userId))
    .orderBy(asc(watchlist.createdAt));

  const body = rows.map((r) => [r.title, r.year, r.tmdbId]);
  return new NextResponse(csvRows([["Title", "Year", "tmdbID"], ...body]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${APP_SLUG}-${username}-letterboxd-watchlist.csv"`,
    },
  });
}

/** Everything the user owns, as JSON. Free forever, never paywalled. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const format = new URL(req.url).searchParams.get("format");
  if (format === "letterboxd") return letterboxdDiaryCsv(user.id, user.username);
  if (format === "letterboxd-watchlist") return letterboxdWatchlistCsv(user.id, user.username);

  const entries = await db
    .select({
      title: films.title,
      year: films.year,
      tmdbId: films.tmdbId,
      watchedOn: diaryEntries.watchedOn,
      rating: diaryEntries.rating,
      review: diaryEntries.review,
      spoiler: diaryEntries.spoiler,
      private: diaryEntries.private,
      rewatch: diaryEntries.rewatch,
      createdAt: diaryEntries.createdAt,
    })
    .from(diaryEntries)
    .innerJoin(films, eq(films.id, diaryEntries.filmId))
    .where(eq(diaryEntries.userId, user.id));

  const wl = await db
    .select({
      title: films.title,
      year: films.year,
      tmdbId: films.tmdbId,
      source: watchlist.source,
      addedAt: watchlist.createdAt,
    })
    .from(watchlist)
    .innerJoin(films, eq(films.id, watchlist.filmId))
    .where(eq(watchlist.userId, user.id));

  const memberships = await db
    .select({ listId: listMembers.listId, role: listMembers.role })
    .from(listMembers)
    .where(eq(listMembers.userId, user.id));
  const myLists = memberships.length
    ? await db
        .select()
        .from(lists)
        .where(inArray(lists.id, memberships.map((m) => m.listId)))
    : [];
  const items = myLists.length
    ? await db
        .select({
          listId: listItems.listId,
          title: films.title,
          year: films.year,
          tmdbId: films.tmdbId,
        })
        .from(listItems)
        .innerJoin(films, eq(films.id, listItems.filmId))
        .where(inArray(listItems.listId, myLists.map((l) => l.id)))
    : [];

  const body = {
    exportedAt: new Date().toISOString(),
    username: user.username,
    diary: entries.map((e) => ({
      ...e,
      rating: e.rating === null ? null : formatTenths(e.rating),
      // what this rating becomes on Letterboxd's half-star scale
      ratingStars: e.rating === null ? null : formatStars(e.rating),
    })),
    watchlist: wl,
    lists: myLists.map((l) => ({
      title: l.title,
      description: l.description,
      role: memberships.find((m) => m.listId === l.id)?.role,
      films: items
        .filter((i) => i.listId === l.id)
        .map((i) => ({ title: i.title, year: i.year, tmdbId: i.tmdbId })),
    })),
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${APP_SLUG}-${user.username}.json"`,
    },
  });
}
