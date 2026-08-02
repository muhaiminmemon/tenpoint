import Link from "next/link";
import PosterImg from "./PosterImg";
import type { SimilarFilm } from "@/lib/similar";

/**
 * Where a film page stops being a dead end.
 *
 * Everything above this decides about one film: the scores, the rating dial,
 * what friends made of it. Then the page ended, and the only way onward was
 * the back button. This is the exit, and it sits after the reviews because
 * discovery should follow the decision rather than interrupt it.
 *
 * Every tile carries the real overlap that put it there, in words a reader
 * could check against the two films themselves. That is the whole difference
 * between this and a recommendation strip: nothing here says 87% match,
 * because the product does not know that and would not print it if it did.
 *
 * Native overflow with snap points, the same as the browse rails. No carousel,
 * no arrows, no JavaScript, and it already works with a trackpad, a
 * touchscreen and a keyboard.
 */
export default function SimilarRail({ films }: { films: SimilarFilm[] }) {
  if (films.length === 0) return null;

  return (
    <section aria-labelledby="similar" className="mt-14 min-w-0">
      <h2 id="similar" className="display text-[19px] leading-none text-paper">
        More like this
      </h2>
      <p className="mt-1.5 text-[12.5px] text-ash">
        Ranked by how close each one sits to this film. The line under each says why.
      </p>

      <ul className="mt-4 -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {films.map((f) => (
          <li key={f.slug} className="w-[132px] shrink-0 snap-start sm:w-[148px]">
            <Link href={`/film/${f.slug}`} className="group block focus-visible:outline-none">
              <span className="relative block overflow-hidden rounded-card border border-seam bg-tray transition-colors group-hover:border-dim group-focus-visible:border-beam">
                <PosterImg
                  posterPath={f.posterPath}
                  title={f.title}
                  size="w342"
                  sizes="(max-width: 640px) 33vw, 150px"
                  className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </span>
              <span className="mt-2 flex items-baseline gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[13px] text-paper">{f.title}</span>
                {f.year && <span className="num shrink-0 text-[11px] text-dim">{f.year}</span>}
              </span>
              {/* The reason is the point of the tile, so it gets two lines
                  rather than a truncation: a cut-off reason is worse than a
                  slightly taller row. */}
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ash">{f.why}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
