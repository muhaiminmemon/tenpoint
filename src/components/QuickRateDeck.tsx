"use client";

import { useState } from "react";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb-urls";

export type QuickRateFilm = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
};

function sample(pool: QuickRateFilm[], n: number): QuickRateFilm[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/** Tap a title you've already seen and go rate it, no typing required. */
export default function QuickRateDeck({ pool }: { pool: QuickRateFilm[] }) {
  // deterministic on first render (server and client must match); shuffling
  // afterward is a plain client interaction, so Math.random() there is safe
  const [shown, setShown] = useState(() => pool.slice(0, 10));

  if (pool.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-ash">
          Or just start rating. Tap one you&apos;ve seen
        </h2>
        <button
          type="button"
          onClick={() => setShown(sample(pool, 10))}
          className="text-sm text-beam hover:underline"
        >
          Shuffle
        </button>
      </div>
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {shown.map((f) => {
          const poster = posterUrl(f.posterPath, "w154");
          return (
            <li key={f.tmdbId} className="w-24 shrink-0">
              <Link href={`/film/t/${f.tmdbId}`} className="block">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poster}
                    alt=""
                    loading="lazy"
                    className="aspect-[2/3] w-full rounded-card bg-tray object-cover"
                  />
                ) : (
                  <span className="flex aspect-[2/3] w-full items-center justify-center rounded-card bg-tray p-2 text-center text-[11px] text-ash">
                    {f.title}
                  </span>
                )}
                <span className="mt-1.5 line-clamp-2 block text-[12px] text-paper">{f.title}</span>
                <span className="block text-[11px] text-beam">+ rate</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
