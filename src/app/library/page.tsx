import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getRankedLibrary } from "@/lib/library";
import { getSeriesProgress } from "@/lib/series-progress";
import LibraryView from "@/components/LibraryView";
import RatingHistogram from "@/components/RatingHistogram";

export const metadata = { title: "Library" };

export default async function LibraryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [films, series] = await Promise.all([
    getRankedLibrary(user.id),
    // Their own shelf, so private entries count toward finishing something.
    getSeriesProgress(user.id, { includePrivate: true }),
  ]);
  const rated = films.filter((f) => f.rating !== null);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Library</h1>
          <p className="mt-1 text-sm text-ash">
            Everything you&apos;ve seen, ranked by your current rating, one row per title.
            Individual viewings live in your{" "}
            <Link href="/diary" className="text-paper underline underline-offset-2">
              diary
            </Link>
            .
          </p>
        </div>
        <RatingHistogram ratings={rated.map((f) => f.rating!)} />
      </div>

      {films.length === 0 ? (
        <div className="max-w-md py-12">
          <p className="text-lg text-paper">Your library is empty.</p>
          <p className="mt-2 text-ash">
            Import an existing diary, or search a film up top and log your first viewing.
          </p>
          <div className="mt-6 flex gap-4">
            <Link
              href="/import"
              className="rounded-card bg-paper px-4 py-2 text-sm font-medium text-carbon hover:bg-white"
            >
              Import a diary
            </Link>
          </div>
        </div>
      ) : (
        <LibraryView films={films} editable series={series} />
      )}
    </div>
  );
}
