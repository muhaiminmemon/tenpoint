"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { useRouter } from "next/navigation";
import { accentFor } from "@/lib/format";

type FilmHit = {
  tmdbId?: number;
  slug?: string;
  title: string;
  year: number | null;
  director?: string | null;
  /** "show" on a series; its seasons are what get rated, so it opens elsewhere */
  kind?: "show";
  /** series carry their own slug space, so the link is built from this */
  showSlug?: string | null;
};

/** The hero search bar: type a title, press enter, land on its page to rate it. */
export default function HomeSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [films, setFilms] = useState<FilmHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      // nothing to search yet; `active` below hides any stale results
      abort.current?.abort();
      return;
    }
    const timer = setTimeout(async () => {
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
        setOpen(true);
      } catch {
        /* aborted or offline */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(f: FilmHit) {
    // A series is not rated here, its seasons are, so it opens the show page.
    // This bar sent everything to /film/, which for a series meant a film
    // page built from a television id: a different work, or nothing at all.
    if (f.kind === "show") {
      router.push(f.showSlug ? `/show/${f.showSlug}` : `/show/t/${f.tmdbId}`);
    } else {
      router.push(f.slug ? `/film/${f.slug}` : `/film/t/${f.tmdbId}`);
    }
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(films.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter" && films[cursor]) {
      e.preventDefault();
      go(films[cursor]);
    }
  }

  const active = q.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2.5 rounded-xl border border-seam bg-carbon px-4 py-3.5 transition-colors focus-within:border-beam">
        <MagnifyingGlass aria-hidden className="size-4 shrink-0 text-dim" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => films.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Name a film you've seen…"
          aria-label="Search for a film to rate"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-paper placeholder:text-dim focus:outline-none"
        />
        <span className="hidden shrink-0 rounded border border-seam px-1.5 py-0.5 text-[11px] text-dim sm:inline-block">
          enter to rate
        </span>
      </div>

      {open && active && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-seam bg-lift shadow-[0_20px_50px_rgba(0,0,0,.5)]">
          {loading && films.length === 0 && (
            <p className="px-4 py-3 text-sm text-dim">Searching…</p>
          )}
          {!loading && films.length === 0 && (
            <p className="px-4 py-3 text-sm text-dim">Nothing found.</p>
          )}
          <ul className="max-h-72 overflow-y-auto p-1.5">
            {films.map((f, i) => (
              <li key={`${f.kind ?? "film"}-${f.slug ?? f.showSlug ?? f.tmdbId}`}>
                <button
                  type="button"
                  onClick={() => go(f)}
                  onMouseEnter={() => setCursor(i)}
                  className={`flex w-full items-center gap-3 rounded-card px-2.5 py-2 text-left ${
                    cursor === i ? "bg-tray" : ""
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-8 w-[3px] shrink-0 rounded-sm"
                    style={{ background: accentFor(f.slug ?? String(f.tmdbId)) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-paper">{f.title}</span>
                    <span className="num block truncate text-[11px] text-ash">
                      {/* Series say so. Both kinds are in this list now, and a
                          title alone does not tell you which you are about to
                          open, or why one of them will not ask for a rating. */}
                      {[f.kind === "show" ? "Series" : null, f.year, f.director]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
