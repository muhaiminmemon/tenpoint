import Link from "next/link";
import { posterUrl } from "@/lib/tmdb-urls";

export type ProfileWatchlistRow = {
  filmId: string;
  title: string;
  year: number | null;
  slug: string;
  posterPath: string | null;
};

export default function ProfileWatchlistList({ rows }: { rows: ProfileWatchlistRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="divide-y divide-seam border-y border-seam">
      {rows.map((r) => {
        const poster = posterUrl(r.posterPath, "w154");
        return (
          <li key={r.filmId} className="flex items-center gap-3 py-2">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt={`Poster for ${r.title}`}
                loading="lazy"
                className="h-[45px] w-[30px] shrink-0 rounded-[3px] bg-tray object-cover"
              />
            ) : (
              <span className="h-[45px] w-[30px] shrink-0 rounded-[3px] bg-tray" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <Link href={`/film/${r.slug}`} className="block truncate text-paper hover:underline">
                {r.title} <span className="num text-xs text-ash">{r.year ?? ""}</span>
              </Link>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
