"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowsClockwise } from "@phosphor-icons/react/ssr";
import PosterImg from "./PosterImg";
import type { SimilarFilm } from "@/lib/similar";

/** One row on every breakpoint, matching the shelf and the browse grid. */
const PAGE = 6;

/**
 * Where a film page stops being a dead end.
 *
 * Everything above this decides about one film: the scores, the rating dial,
 * what friends made of it. Then the page ended, and the only way onward was
 * the back button. This is the exit, and it sits after the reviews because
 * discovery should follow the decision rather than interrupt it.
 *
 * A grid rather than a scrolling rail, which is what this was first and what
 * was wrong with it. Browse rails scroll because they are slices of something
 * larger with a "see all" at the end. This is the whole list, inside a fixed
 * column, so scrolling it only produced a poster sliced in half at the right
 * edge and no hint that anything lay past it. The same three-to-six grid the
 * library shelf and the browse results already use fits exactly and cuts
 * nothing.
 *
 * Every tile carries the real overlap that put it there, in words a reader
 * could check against the two films themselves. That is the whole difference
 * between this and a recommendation strip: nothing here says 87% match,
 * because the product does not know that and would not print it if it did.
 */
export default function SimilarRail({
  films,
  alreadySeen,
}: {
  films: SimilarFilm[];
  /** close films withheld because they are already in the viewer's diary */
  alreadySeen: number;
}) {
  const [from, setFrom] = useState(0);
  if (films.length === 0 && alreadySeen === 0) return null;

  // Rotates rather than randomises. The list is ordered by closeness and the
  // header says so, so shuffling it would make the page lie; walking further
  // down the same ranking keeps that true and still shows something new.
  const shown = Array.from({ length: Math.min(PAGE, films.length) }, (_, i) => films[(from + i) % films.length]);
  const canRotate = films.length > PAGE;
  const empty = films.length === 0;

  return (
    <section aria-labelledby="similar" className="mt-14 min-w-0">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <h2 id="similar" className="display text-[19px] leading-none text-paper">
            More like this
          </h2>
          <p className="mt-1.5 text-[12px] text-ash">
            {films.length > 0
              ? "Closest first. The line under each one says why it is here."
              : "Everything close to this is already in your diary."}
            {alreadySeen > 0 && films.length > 0 && (
              <>
                {" "}
                {alreadySeen} more {alreadySeen === 1 ? "is" : "are"} hidden because you have
                logged {alreadySeen === 1 ? "it" : "them"}.
              </>
            )}
          </p>
        </div>
        {canRotate && !empty && (
          <button
            type="button"
            onClick={() => setFrom((f) => (f + PAGE) % films.length)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-seam px-3 py-1.5 text-[13px] text-ash transition-colors hover:border-dim hover:text-paper focus-visible:border-beam"
          >
            <ArrowsClockwise aria-hidden className="size-3.5" />
            Show others
          </button>
        )}
      </div>

      {/* Keyed on the offset so a new set fades in rather than swapping in
          place, which at this size reads as the page glitching. */}
      <ul
        key={from}
        className="pop-in mt-4 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6"
      >
        {shown.map((f) => (
          <li key={f.slug} className="min-w-0">
            <Link href={`/film/${f.slug}`} className="group block focus-visible:outline-none">
              <span className="relative block overflow-hidden rounded-card border border-seam bg-tray transition-colors group-hover:border-dim group-focus-visible:border-beam">
                <PosterImg
                  posterPath={f.posterPath}
                  title={f.title}
                  size="w342"
                  sizes="(max-width: 640px) 33vw, (max-width: 1024px) 22vw, 150px"
                  className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </span>
              <span className="mt-2 flex items-baseline gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[13px] text-paper">{f.title}</span>
                {f.year && <span className="num shrink-0 text-[11px] text-dim">{f.year}</span>}
              </span>
              {/* Two lines, always. Left to itself one reason wraps and the
                  next does not, and the row bottoms out ragged. */}
              <span className="mt-0.5 line-clamp-2 block min-h-[2.4em] text-[11px] leading-snug text-ash">
                {f.why}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
