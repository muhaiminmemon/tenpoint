import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { diaryEntries, films } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import DiaryView, { type DiaryRow } from "@/components/DiaryView";

export const metadata = { title: "Diary" };

export default async function DiaryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const entries: DiaryRow[] = await db
    .select({
      id: diaryEntries.id,
      watchedOn: diaryEntries.watchedOn,
      rating: diaryEntries.rating,
      rewatch: diaryEntries.rewatch,
      private: diaryEntries.private,
      review: diaryEntries.review,
      spoiler: diaryEntries.spoiler,
      title: films.title,
      year: films.year,
      slug: films.slug,
      posterPath: films.posterPath,
      runtime: films.runtime,
    })
    .from(diaryEntries)
    .innerJoin(films, eq(films.id, diaryEntries.filmId))
    .where(eq(diaryEntries.userId, user.id))
    .orderBy(sql`${diaryEntries.watchedOn} desc nulls last`, desc(diaryEntries.createdAt))
    .limit(1000);

  return (
    <div>
      <div className="mb-6">
        <h1 className="display text-2xl">Diary</h1>
        <p className="mt-1 text-sm text-ash">
          Every viewing in order, rewatches included. Your ranked{" "}
          <Link href="/library" className="text-paper underline underline-offset-2">
            library
          </Link>{" "}
          shows one row per film.
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="text-ash">
          Nothing logged yet. Find a film up top, or{" "}
          <Link href="/import" className="text-paper underline">
            import an existing diary
          </Link>
          .
        </p>
      ) : (
        <DiaryView rows={entries} />
      )}
    </div>
  );
}
