import Link from "next/link";
import { formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import type { TopRatedFilm } from "@/lib/leaderboard";

/** The community leaderboard: highest-rated films across everyone here. */
export default function TopRatedBoard({ films }: { films: TopRatedFilm[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-seam bg-carbon">
      <div className="border-b border-seam p-4">
        <h2 className="display text-[19px] text-paper">Top rated on Tenpoint</h2>
        <p className="mt-0.5 text-sm text-ash">
          The highest-rated films across everyone here, not just you.
        </p>
      </div>

      {films.length === 0 ? (
        <p className="p-4 text-sm text-ash">Nobody&apos;s rated anything yet. Be the first.</p>
      ) : (
        <ol className="p-2">
          {films.map((f, i) => {
            const poster = posterUrl(f.posterPath, "w154");
            return (
              <li key={f.slug}>
                <Link
                  href={`/film/${f.slug}`}
                  className="flex items-center gap-3 rounded-card p-2 hover:bg-tray"
                >
                  <span className="num w-5 shrink-0 text-right text-sm text-dim">{i + 1}</span>
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={poster}
                      alt=""
                      loading="lazy"
                      className="h-[54px] w-9 shrink-0 rounded-[3px] bg-tray object-cover"
                    />
                  ) : (
                    <span className="h-[54px] w-9 shrink-0 rounded-[3px] bg-tray" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-paper">
                      {f.title}
                      <span className="num text-ash"> {f.year ?? ""}</span>
                    </span>
                    <span className="block truncate text-[11px] text-ash">
                      {f.director ?? ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`num block text-sm ${ratingColor(f.mean)}`}>
                      {formatTenths(f.mean)}
                    </span>
                    <span className="num block text-[10px] text-dim">
                      {f.voters} {f.voters === 1 ? "rating" : "ratings"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
