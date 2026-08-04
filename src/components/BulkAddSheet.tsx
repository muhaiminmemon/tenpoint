"use client";

import { useMemo, useState } from "react";
import Sheet from "./Sheet";
import { formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";

export type BulkAddFilm = {
  filmId: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  rating: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** the viewer's library, minus what the list already holds */
  films: BulkAddFilm[];
  busy: boolean;
  onAdd: (filmIds: string[]) => void;
};

/** Pick several films from your library and add them in one go. */
export default function BulkAddSheet({ open, onClose, films, busy, onAdd }: Props) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return films;
    return films.filter((f) => f.title.toLowerCase().includes(term));
  }, [films, q]);

  function toggle(filmId: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(filmId)) next.delete(filmId);
      else next.add(filmId);
      return next;
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add from your library">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter your library"
        aria-label="Filter your library"
        className="mt-4 w-full rounded-card border border-seam bg-carbon px-3 py-2 text-sm placeholder:text-dim focus:border-beam focus:outline-none"
      />

      {films.length === 0 ? (
        <p className="mt-4 text-sm text-ash">Every film in your library is already on this list.</p>
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-1">
            {visible.map((f) => {
              const on = picked.has(f.filmId);
              const poster = posterUrl(f.posterPath, "w154");
              return (
                <li key={f.filmId}>
                  <button
                    type="button"
                    onClick={() => toggle(f.filmId)}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-3 rounded-card border p-2 text-left transition-colors ${
                      on ? "border-beam-edge bg-[#161d24]" : "border-transparent hover:bg-tray"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border text-[11px] ${
                        on ? "border-paper bg-paper text-carbon" : "border-seam text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={poster}
                        alt=""
                        loading="lazy"
                        className="h-[42px] w-7 shrink-0 rounded-[3px] bg-tray object-cover"
                      />
                    ) : (
                      <span className="h-[42px] w-7 shrink-0 rounded-[3px] bg-tray" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-paper">{f.title}</span>
                      <span className="num block text-[11px] text-ash">{f.year ?? ""}</span>
                    </span>
                    {f.rating !== null && (
                      <span className={`num text-sm ${ratingColor(f.rating)}`}>
                        {formatTenths(f.rating)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {visible.length === 0 && (
            <p className="mt-3 text-sm text-dim">Nothing in your library matches that.</p>
          )}
        </>
      )}

      {films.length > 0 && (
        <div className="sticky bottom-0 -mx-4 mt-4 border-t border-seam bg-lift px-4 pb-1 pt-3 sm:-mx-6 sm:px-6">
          <button
            type="button"
            disabled={busy || picked.size === 0}
            onClick={() => onAdd([...picked])}
            className="display w-full rounded-card bg-paper py-2.5 text-[15px] font-medium text-carbon hover:bg-white disabled:opacity-50"
          >
            {busy
              ? "Adding…"
              : picked.size === 0
                ? "Pick some films"
                : `Add ${picked.size} ${picked.size === 1 ? "title" : "titles"}`}
          </button>
        </div>
      )}
    </Sheet>
  );
}
