import Link from "next/link";
import PosterImg from "./PosterImg";
import type { BrowseFilm } from "@/lib/browse-query";

/**
 * One film in a grid or a rail.
 *
 * The poster is the whole tile and the type sits under it, because at browsing
 * size a poster is the only thing anyone actually reads — a row of titles in a
 * grid is a spreadsheet. Everything else stays out of the way until hover.
 *
 * It links into `/film/t/{tmdbId}`, which resolves a TMDB id to a local film
 * and catalogues it on the way through. Scrolling the grid writes nothing —
 * the results come straight from TMDB — so a person can look through ten
 * thousand films and only the ones they actually open become rows.
 */
export default function PosterTile({ movie }: { movie: BrowseFilm }) {
  const year = movie.release_date ? movie.release_date.slice(0, 4) : null;

  return (
    <Link
      href={`/film/t/${movie.id}`}
      className="group block focus-visible:outline-none"
      title={movie.title}
    >
      <span className="relative block overflow-hidden rounded-card border border-seam bg-tray transition-colors group-hover:border-dim group-focus-visible:border-beam">
        <PosterImg
          posterPath={movie.poster_path ?? null}
          title={movie.title}
          size="w342"
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 22vw, 150px"
          className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {/* Sits over the artwork only while pointed at, so the grid stays a
            wall of posters rather than a wall of labels. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(8,8,10,.88))] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </span>

      <span className="mt-2 block truncate text-[12.5px] leading-tight text-ash transition-colors group-hover:text-paper">
        {movie.title}
      </span>
      {/* Year left, score right, both in tabular figures — so scanning down a
          column of tiles reads as a column of numbers rather than a ragged
          edge. The score is whichever measure the grid is ranked by, because
          an ordering you cannot see is one you have to take on trust. */}
      {(year || movie.score) && (
        <span className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="num text-[11px] text-dim">{year}</span>
          {movie.score && <span className="num text-[11px] text-ash">{movie.score}</span>}
        </span>
      )}
    </Link>
  );
}
