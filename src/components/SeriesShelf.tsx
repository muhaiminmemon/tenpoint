"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/ssr";
import type { SeriesProgress, SeriesState } from "@/lib/series-progress";
import { formatTenths, ratingColor } from "@/lib/format";

/**
 * The series shelf: one row per programme, not per season.
 *
 * The library lists a row per rated title, which for television meant a viewer
 * of The Simpsons occupied thirty-eight rows and still could not see whether
 * they had finished it. Television asks a question films never did, which is
 * what am I part-way through, and it can only be answered at this grain.
 */

type Slice = "all" | SeriesState;

const SLICES: { key: Slice; label: string }[] = [
  { key: "all", label: "All series" },
  { key: "unfinished", label: "Unfinished" },
  { key: "caughtup", label: "Caught up" },
  { key: "finished", label: "Finished" },
];

/**
 * What each state means, said once above the list.
 *
 * "Caught up" is the one nobody can guess: it is complete now and will lapse
 * when the next season airs, and somebody who is not told that will read the
 * change as the site losing their data.
 */
const BLURB: Record<Slice, string> = {
  all: "Every series you have rated, whether by season or as a whole.",
  unfinished: "Seasons of these are still unrated. The shelf opens here because this is the list worth acting on.",
  caughtup: "You have rated every season that has aired. These move back to unfinished when a new one lands.",
  finished: "Ended, and every season rated. Nothing more is coming.",
};

function stateLabel(s: SeriesProgress): string {
  if (s.state === "finished") return "Finished";
  if (s.state === "caughtup") return "Caught up";
  return `${s.credited} of ${s.totalSeasons}`;
}

export default function SeriesShelf({ series }: { series: SeriesProgress[] }) {
  const [slice, setSlice] = useState<Slice>("all");

  const counts = useMemo(
    () => ({
      all: series.length,
      unfinished: series.filter((s) => s.state === "unfinished").length,
      caughtup: series.filter((s) => s.state === "caughtup").length,
      finished: series.filter((s) => s.state === "finished").length,
    }),
    [series],
  );

  const shown = useMemo(
    () => (slice === "all" ? series : series.filter((s) => s.state === slice)),
    [series, slice],
  );

  if (series.length === 0) {
    return (
      <p className="py-8 text-sm text-ash">
        No series yet. Rate a season, or a whole show, and it will appear here.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Series progress">
        {SLICES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={slice === s.key}
            onClick={() => setSlice(s.key)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
              slice === s.key
                ? "border-paper bg-paper text-carbon"
                : "border-seam bg-tray text-ash hover:text-paper"
            }`}
          >
            {s.label}
            <span className={`num text-[11px] ${slice === s.key ? "text-carbon/60" : "text-dim"}`}>
              {counts[s.key]}
            </span>
          </button>
        ))}
      </div>

      <p className="mb-4 max-w-prose text-[12.5px] text-dim">{BLURB[slice]}</p>

      {shown.length === 0 ? (
        <p className="py-8 text-sm text-ash">Nothing in that group yet.</p>
      ) : (
        <ul className="border-t border-seam">
          {shown.map((s) => {
            // The whole-series rating stands in when no season was rated
            // individually, because it is the only opinion on file.
            const score = s.meanRating ?? s.wholeRating;
            const pct = s.totalSeasons > 0 ? Math.min(100, (s.credited / s.totalSeasons) * 100) : 0;

            return (
              <li key={s.showId}>
                <Link
                  href={`/show/${s.slug}`}
                  className="group flex items-center gap-4 border-b border-seam px-1 py-3.5 transition-colors hover:bg-tray"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-paper">{s.name}</span>
                    <span className="num mt-1 block truncate text-[12px] text-ash">
                      {[
                        stateLabel(s),
                        s.nextSeason ? `next up season ${s.nextSeason}` : null,
                        s.ratedWhole && s.ratedSeasons === 0 ? "rated as a whole" : null,
                      ]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </span>
                    {/* The bar carries the same number the line above states.
                        It is the fastest read of how far in somebody is, and
                        it stays put for finished series rather than vanishing,
                        so the rows do not jump between groups. */}
                    <span
                      aria-hidden
                      className="mt-2 block h-[3px] w-full max-w-56 overflow-hidden rounded-sm bg-seam"
                    >
                      <span
                        className="block h-full rounded-sm bg-beam transition-[width] duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </span>

                  {score !== null && (
                    <span className={`num shrink-0 text-[19px] ${ratingColor(score)}`}>
                      {formatTenths(score)}
                    </span>
                  )}
                  <CaretRight aria-hidden className="size-3.5 shrink-0 text-dim" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
