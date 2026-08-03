"use client";

import { useEffect, useRef, useState } from "react";
import { usePresence } from "@/lib/usePresence";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb-urls";
import { formatTenths, ratingColor } from "@/lib/format";
import { errorFrom, readJson } from "@/lib/http";

type RecFilm = {
  filmId: string;
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  director: string | null;
  blurb: string;
  predicted: { username: string; rating: number }[];
};

type RecResponse =
  | { eligible: false; shortfall: { username: string; rated: number; strong: number }[] }
  | { eligible: true; films: RecFilm[] }
  | { error: string };

export default function RecsView({ friend }: { friend: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [films, setFilms] = useState<RecFilm[]>([]);
  const [ineligible, setIneligible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const requested = useRef(false);

  async function load() {
    setState("loading");
    setError(null);
    // without this a first "not eligible yet" answer sticks for the session,
    // even once the user has rated enough films
    setIneligible(false);
    try {
      const res = await fetch("/api/recs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friend }),
      });
      const data = (await readJson<Record<string, unknown>>(res)) as RecResponse;
      if ("error" in data) {
        setError(data.error);
        setState("error");
        return;
      }
      if (!data.eligible) {
        setIneligible(true);
        setState("ready");
        return;
      }
      setFilms(data.films);
      setState("ready");
    } catch {
      setError("Couldn't load recommendations. Try again.");
      setState("error");
    }
  }

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function feedback(film: RecFilm, action: "save" | "seen" | "not_interested") {
    setError(null);
    const res = await fetch("/api/recs/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friend, filmId: film.filmId, action }),
    }).catch(() => null);
    // don't claim it saved if it didn't
    if (!res?.ok) {
      setError(
        res ? await errorFrom(res, "That didn't save. Try again.") : "Couldn't reach the server.",
      );
      return;
    }
    if (action === "save") {
      setSavedIds((s) => new Set(s).add(film.filmId));
    } else {
      setFilms((fs) => fs.filter((f) => f.filmId !== film.filmId));
    }
  }

  if (state === "loading") {
    return <p className="text-ash">Comparing your libraries…</p>;
  }
  if (state === "error") {
    return (
      <div>
        <p className="text-warn">{error}</p>
        <button type="button" onClick={load} className="mt-2 text-sm text-ash underline hover:text-paper">
          Try again
        </button>
      </div>
    );
  }
  if (ineligible) {
    return (
      <div className="rounded-card border border-seam bg-tray p-5">
        <h2 className="text-paper">Rate or import a few more films first</h2>
        <p className="mt-2 text-sm text-ash">
          We need at least 20 ratings from each of you, including a handful above 8.0, to find
          a useful match.
        </p>
        <Link href="/import" className="mt-3 inline-block text-sm text-paper underline">
          Import a diary
        </Link>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="mb-4 text-sm text-warn">{error}</p>}
      <ul className="space-y-4">
        {films.map((f) => {
          const poster = posterUrl(f.posterPath, "w154");
          const saved = savedIds.has(f.filmId);
          return (
            <li key={f.filmId} className="fade-up flex gap-4 rounded-card border border-seam bg-tray p-3">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={poster}
                  alt={`Poster for ${f.title}`}
                  loading="lazy"
                  className="h-[90px] w-[60px] shrink-0 rounded-[3px] bg-carbon object-cover"
                />
              ) : (
                <span className="h-[90px] w-[60px] shrink-0 rounded-[3px] bg-carbon" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/film/${f.slug}`} className="text-paper hover:underline">
                    {f.title} <span className="num text-sm text-ash">{f.year ?? ""}</span>
                  </Link>
                  <RecMenu
                    onSeen={() => feedback(f, "seen")}
                    onNotInterested={() => feedback(f, "not_interested")}
                    title={f.title}
                  />
                </div>
                {f.director && <p className="text-xs text-ash">{f.director}</p>}
                {/* What the model thinks each of you would give it. Printed in
                    the product's own unit rather than as a match percentage,
                    because a reader can check a 7.8 against themselves once
                    they have actually watched the thing. */}
                <Predicted predicted={f.predicted} friend={friend} />
                <p className="mt-1.5 text-sm text-ash">{f.blurb}</p>
                <button
                  type="button"
                  disabled={saved}
                  onClick={() => feedback(f, "save")}
                  className="mt-2 text-sm text-paper underline-offset-2 hover:underline disabled:text-ash disabled:no-underline"
                >
                  {saved ? "Saved to your shared list" : "Add to shared list"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {films.length === 0 && (
        <p className="text-ash">
          Nothing left to suggest right now. Log a few more films and come back.
        </p>
      )}
      <div className="mt-6">
        <button
          type="button"
          onClick={load}
          className="rounded-card border border-seam px-4 py-1.5 text-sm text-paper hover:bg-tray"
        >
          Show five more
        </button>
      </div>
    </div>
  );
}

function Predicted({
  predicted,
  friend,
}: {
  predicted: { username: string; rating: number }[];
  friend: string;
}) {
  const mine = predicted.find((p) => p.username !== friend);
  const theirs = predicted.find((p) => p.username === friend);
  if (!mine || !theirs) return null;
  return (
    <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-[12px] text-dim">
      <span className={`num ${ratingColor(mine.rating)}`}>{formatTenths(mine.rating)}</span>
      <span>for you</span>
      <span aria-hidden>·</span>
      <span className={`num ${ratingColor(theirs.rating)}`}>{formatTenths(theirs.rating)}</span>
      <span>for {friend}</span>
    </p>
  );
}

function RecMenu({
  onSeen,
  onNotInterested,
  title,
}: {
  onSeen: () => void;
  onNotInterested: () => void;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const { rendered, state } = usePresence(open, 130);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={`Options for ${title}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-card px-2 text-ash hover:bg-tray-2 hover:text-paper"
      >
        ⋯
      </button>
      {rendered && (
        <div className={`${state === "out" ? "pop-out" : "pop-in"} absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-card border border-seam bg-tray-2 text-sm shadow-lg`}>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSeen();
            }}
            className="block w-full px-3 py-2 text-left text-paper hover:bg-seam"
          >
            Already seen
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onNotInterested();
            }}
            className="block w-full px-3 py-2 text-left text-paper hover:bg-seam"
          >
            Not interested
          </button>
        </div>
      )}
    </div>
  );
}
