import Link from "next/link";
import PosterTile from "./PosterTile";
import type { TmdbMovie } from "@/lib/tmdb";

/**
 * A named row of films that scrolls sideways.
 *
 * The default browse view is rails rather than one grid because an unfiltered
 * grid answers a question nobody asked — "here are all films, in some order".
 * A rail states what it is, which is the difference between a catalogue and a
 * pile.
 *
 * Scrolling is native overflow with snap points: no carousel, no arrows, no
 * JavaScript. It already works with a trackpad, a touchscreen, and the
 * keyboard, and a carousel component would only take those away.
 */
export default function FilmRail({
  title,
  note,
  movies,
  href,
}: {
  title: string;
  note?: string;
  movies: TmdbMovie[];
  /** the filtered grid this rail is a slice of */
  href?: string;
}) {
  if (movies.length === 0) return null;

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-4 px-4 sm:px-0">
        <div className="min-w-0">
          <h2 className="display text-[19px] leading-none text-paper">{title}</h2>
          {note && <p className="mt-1.5 text-[12.5px] text-ash">{note}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 text-[12.5px] text-beam transition-colors hover:text-paper"
          >
            See all &rarr;
          </Link>
        )}
      </div>

      {/* The negative gutter lets the row bleed to the screen edge on a phone,
          so the last poster is visibly cut rather than sitting flush — which is
          what tells a thumb there is more to the right. */}
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {movies.map((m) => (
          <li key={m.id} className="w-[116px] shrink-0 snap-start sm:w-[132px]">
            <PosterTile movie={m} />
          </li>
        ))}
      </ul>
    </section>
  );
}
