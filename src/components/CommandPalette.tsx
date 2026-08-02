"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePresence } from "@/lib/usePresence";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import { OPEN_SEARCH_EVENT } from "@/lib/search-event";

type FilmHit = {
  id?: string;
  tmdbId?: number;
  slug?: string;
  title: string;
  year: number | null;
  director?: string | null;
  posterPath: string | null;
  rating?: number | null;
};

/**
 * Film search as a destination you can reach from anywhere. Ctrl+K (or Cmd+K)
 * opens it over whatever you were doing; Escape puts you back. Navigation lives
 * in the nav bar, so this searches films and nothing else.
 */
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { rendered, state } = usePresence(open, 180);
  const [q, setQ] = useState("");
  const [films, setFilms] = useState<FilmHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  /** Always opens clean, so yesterday's query isn't waiting for you. */
  const openPalette = useCallback(() => {
    setQ("");
    setFilms([]);
    setCursor(0);
    setLoading(false);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else openPalette();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, openPalette]);

  // the bottom nav has no room for the desktop trigger button, so it opens
  // this instead by dispatching an event rather than lifting state up
  useEffect(() => {
    function onOpenRequest() {
      openPalette();
    }
    window.addEventListener(OPEN_SEARCH_EVENT, onOpenRequest);
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, onOpenRequest);
  }, [openPalette]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      // nothing to search yet; `active` below hides any stale results
      abort.current?.abort();
      return;
    }
    const timer = setTimeout(async () => {
      // a slow answer for "po" must never overwrite results for "port"
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { results?: FilmHit[] };
        setFilms((data.results ?? []).slice(0, 6));
        setCursor(0);
      } catch {
        /* aborted or offline; the previous list stays */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  const term = q.trim().toLowerCase();
  // results only count once the query is long enough to have been searched
  const active = term.length >= 2;

  const rows = useMemo(() => {
    if (!active) return [];
    return films.map((f) => {
      const href = f.slug ? `/film/${f.slug}` : `/film/t/${f.tmdbId}`;
      const poster = posterUrl(f.posterPath, "w154");
      return {
        key: `f:${f.slug ?? f.tmdbId}`,
        go: () => {
          router.push(href);
          setOpen(false);
        },
        node: (
          <div className="flex items-center gap-3">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt=""
                className="h-[42px] w-7 shrink-0 rounded-[3px] bg-tray object-cover"
              />
            ) : (
              <span className="h-[42px] w-7 shrink-0 rounded-[3px] bg-tray" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-paper">{f.title}</span>
              <span className="num block truncate text-[11px] text-ash">
                {[f.year, f.director].filter(Boolean).join(" · ")}
              </span>
            </span>
            {f.rating != null && (
              <span className={`num text-sm ${ratingColor(f.rating)}`}>
                {formatTenths(f.rating)}
              </span>
            )}
          </div>
        ),
      };
    });
  }, [active, films, router]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(rows.length - 1, c + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        rows[cursor]?.go();
      }
    },
    [rows, cursor],
  );

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-label="Search films"
        className="flex items-center gap-2 rounded-card border border-seam px-2.5 py-1.5 text-xs text-ash hover:text-paper sm:px-3"
      >
        <MagnifyingGlass className="pointer-events-none absolute left-4 size-5 text-dim" aria-hidden />
        {/* The label is desktop-only: on a phone the icon carries it, and the
            header has a logo and an avatar to fit alongside. */}
        <span className="hidden sm:inline">Search films</span>
      </button>

      {rendered && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close search"
            onClick={() => setOpen(false)}
            className={`${state === "out" ? "scrim-out" : "scrim-in"} absolute inset-0 w-full cursor-default bg-[rgba(8,8,10,.62)]`}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            onKeyDown={onKeyDown}
            className={`${state === "out" ? "palette-out" : "palette-in"} absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-[20px] border-t border-beam-edge bg-lift shadow-[0_-20px_60px_rgba(0,0,0,.55)] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-[8vh] sm:w-[560px] sm:max-w-[calc(100vw-2rem)] sm:max-h-none sm:-translate-x-1/2 sm:rounded-xl sm:border sm:shadow-[0_30px_80px_rgba(0,0,0,.6)]`}
          >
            {/* grab handle reads as "drag me" on touch; decorative on desktop */}
            <div aria-hidden className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-seam sm:hidden" />

            <div className="flex items-center gap-2.5 border-b border-seam px-4 py-3.5">
              <span aria-hidden className="text-dim">
                ⌕
              </span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search for a film…"
                aria-label="Search"
                inputMode="search"
                enterKeyHint="search"
                className="min-w-0 flex-1 bg-transparent text-[16px] text-paper placeholder:text-dim focus:outline-none sm:text-[15px]"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 text-sm text-ash hover:text-paper sm:hidden"
              >
                Cancel
              </button>
              <span className="hidden rounded border border-seam px-1.5 py-0.5 text-[11px] text-dim sm:inline-block">
                esc
              </span>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:max-h-[52vh] sm:pb-2">
              {rows.map((r, i) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={r.go}
                  onMouseEnter={() => setCursor(i)}
                  className={`block w-full rounded-card px-2.5 py-2.5 text-left active:bg-tray sm:py-2 ${
                    cursor === i ? "bg-tray" : ""
                  }`}
                >
                  {r.node}
                </button>
              ))}
              {!active && (
                <p className="px-2.5 py-3 text-sm text-dim">
                  Type at least two letters to search.
                </p>
              )}
              {active && loading && <p className="px-2.5 py-3 text-sm text-dim">Searching…</p>}
              {active && !loading && rows.length === 0 && (
                <p className="px-2.5 py-3 text-sm text-dim">Nothing found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
