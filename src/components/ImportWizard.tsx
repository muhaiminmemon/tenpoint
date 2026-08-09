"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatTenths } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";

type ImportRow = {
  key: string;
  kind: "diary" | "ratings" | "watched" | "watchlist";
  name: string;
  year: number | null;
  uri: string | null;
  rating: number | null;
  watchedOn: string | null;
  rewatch: boolean;
};

type Match = { tmdbId: number; title: string; year: number | null; posterPath: string | null };

type Step = "upload" | "matching" | "preview" | "done";

function filmKey(r: { name: string; year: number | null }) {
  return `${r.name.toLowerCase()}|${r.year ?? ""}`;
}

export default function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [matches, setMatches] = useState<Record<string, Match | null>>({});
  const [corrections, setCorrections] = useState<Record<string, Match>>({});
  const [skips, setSkips] = useState<Set<string>>(new Set());
  /**
   * Bring the watching, leave the scores.
   *
   * Somebody arriving from another site often wants to rate things here rather
   * than inherit a decade of numbers from a different scale, and a shelf of
   * imported scores is a shelf they will never revisit. Offered at the review
   * step, not the upload, so the choice is made while looking at what the file
   * actually said.
   */
  const [dropRatings, setDropRatings] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    diary: number;
    ratings: number;
    watched: number;
    watchlist: number;
    unmatched: number;
  } | null>(null);
  const [undone, setUndone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uniqueFilms = useMemo(() => {
    const map = new Map<string, { name: string; year: number | null; count: number }>();
    for (const r of rows) {
      const k = filmKey(r);
      const cur = map.get(k);
      if (cur) cur.count++;
      else map.set(k, { name: r.name, year: r.year, count: 1 });
    }
    return map;
  }, [rows]);

  const unmatchedKeys = useMemo(
    () =>
      [...uniqueFilms.keys()].filter(
        (k) => matches[k] === null && !corrections[k] && !skips.has(k),
      ),
    [uniqueFilms, matches, corrections, skips],
  );

  async function handleUpload() {
    const files = fileRef.current?.files;
    if (!files?.length) {
      setError("Choose the CSV files from your export first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      const res = await fetch("/api/import/parse", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't read those files.");
        return;
      }
      setImportId(data.importId);
      setRows(data.rows);
      setStep("matching");
      await runMatching(data.importId, data.rows);
    } finally {
      setBusy(false);
    }
  }

  async function runMatching(id: string, allRows: ImportRow[]) {
    const total = new Set(allRows.map(filmKey)).size;
    setProgress({ done: 0, total });
    let done = 0;
    for (;;) {
      const res = await fetch("/api/import/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Matching failed partway. You can retry below.");
        setStep("preview");
        return;
      }
      const data: { matches: Record<string, Match | null>; remaining: number } = await res.json();
      const gained = Object.keys(data.matches).length;
      done += gained;
      setMatches((m) => ({ ...m, ...data.matches }));
      setProgress({ done, total });
      if (data.remaining <= 0 || gained === 0) break;
    }
    setStep("preview");
  }

  async function handleCommit() {
    if (!importId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId, corrections, skips: [...skips], dropRatings }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed. Nothing was changed, so try again.");
        return;
      }
      setResult(data);
      setStep("done");
    } finally {
      setBusy(false);
    }
  }

  async function handleUndo() {
    if (!importId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/import/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId }),
      });
      if (res.ok) setUndone(true);
    } finally {
      setBusy(false);
    }
  }

  if (step === "upload") {
    return (
      <div className="max-w-xl">
        <p className="text-ash">
          From Letterboxd: open Settings, then Import &amp; Export, then Export your data. Unzip
          it and upload <code className="text-paper">ratings.csv</code>. From MyAnimeList: open
          Profile, then Export, then unzip and upload the{" "}
          <code className="text-paper">.xml</code>.
        </p>
        <p className="mt-3 text-sm text-ash">
          Letterboxd stars carry over doubled: 4★ becomes 8.0, 3½★ becomes 7.0. MyAnimeList
          scores carry over exactly, a 9 becoming 9.0, and each anime season arrives as its own
          season here, which is how it was scored. Your history stays intact: you can undo an
          import, and importing the same file twice never duplicates entries.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xml,text/csv,text/xml,application/xml"
            multiple
            aria-label="Diary export files"
            className="text-sm text-ash file:mr-3 file:rounded-card file:border file:border-seam file:bg-tray file:px-3 file:py-1.5 file:text-paper hover:file:bg-tray-2"
          />
          <button
            type="button"
            onClick={handleUpload}
            disabled={busy}
            className="rounded-card bg-paper px-4 py-1.5 text-sm font-medium text-carbon hover:bg-white disabled:opacity-50"
          >
            {busy ? "Reading…" : "Read files"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-warn">{error}</p>}
      </div>
    );
  }

  if (step === "matching") {
    return (
      <div className="max-w-xl">
        <p className="text-paper">Matching your films against TMDB…</p>
        <p className="num mt-2 text-sm text-ash">
          {progress.done} of {progress.total} titles
        </p>
        <div className="mt-3 h-1 w-full overflow-hidden rounded bg-tray" role="progressbar"
          aria-valuenow={progress.done} aria-valuemin={0} aria-valuemax={progress.total}>
          <div
            className="h-full bg-beam transition-[width]"
            style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : "0%" }}
          />
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="max-w-xl">
        {undone ? (
          <>
            <h2 className="display text-xl">Import undone</h2>
            <p className="mt-2 text-ash">Everything from this import was removed.</p>
          </>
        ) : (
          <>
            <h2 className="display text-xl">Imported</h2>
            <ul className="num mt-3 space-y-1 text-sm text-ash">
              {result?.diary ? <li>{result.diary} diary entries</li> : null}
              {result?.ratings ? <li>{result.ratings} ratings imported</li> : null}
              {result?.watched ? <li>{result.watched} films marked watched</li> : null}
              {result?.watchlist ? <li>{result.watchlist} watchlist films</li> : null}
              {result?.unmatched ? (
                <li className="text-warn">{result.unmatched} rows skipped (no match)</li>
              ) : null}
            </ul>
            <div className="mt-5 flex items-center gap-4">
              <Link
                href="/library"
                className="rounded-card bg-paper px-4 py-1.5 text-sm font-medium text-carbon hover:bg-white"
              >
                Open your library
              </Link>
              <button
                type="button"
                onClick={handleUndo}
                disabled={busy}
                className="text-sm text-ash hover:text-warn disabled:opacity-50"
              >
                Undo this import
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // preview
  const counts = rows.reduce(
    (acc, r) => {
      acc[r.kind]++;
      return acc;
    },
    { diary: 0, ratings: 0, watched: 0, watchlist: 0 },
  );

  return (
    <div className="max-w-2xl">
      <h2 className="display text-xl">Ready to import</h2>
      <p className="num mt-2 text-sm text-ash">
        {[
          counts.diary && `${counts.diary} diary entries`,
          counts.ratings && `${counts.ratings} ratings`,
          counts.watched && `${counts.watched} watched films`,
          counts.watchlist && `${counts.watchlist} watchlist films`,
        ]
          .filter(Boolean)
          .join(" · ")}{" "}
        · {uniqueFilms.size} unique films
      </p>

      {unmatchedKeys.length > 0 && (
        <section className="mt-5 rounded-card border border-seam bg-tray p-4">
          <h3 className="text-paper">
            {unmatchedKeys.length} {unmatchedKeys.length === 1 ? "title needs" : "titles need"} a match
          </h3>
          <p className="mt-1 text-sm text-ash">
            Find each one on TMDB, or skip it. Everything else imports either way.
          </p>
          <ul className="mt-3 space-y-3">
            {unmatchedKeys.slice(0, 20).map((k) => {
              const film = uniqueFilms.get(k)!;
              return (
                <MatchFixer
                  key={k}
                  name={film.name}
                  year={film.year}
                  onPick={(m) => setCorrections((c) => ({ ...c, [k]: m }))}
                  onSkip={() => setSkips((s) => new Set(s).add(k))}
                />
              );
            })}
          </ul>
        </section>
      )}

      <PreviewList rows={rows} matches={matches} corrections={corrections} skips={skips} />

      <label className="mt-6 flex max-w-prose cursor-pointer items-start gap-3 rounded-card border border-seam bg-tray p-3.5">
        <input
          type="checkbox"
          checked={dropRatings}
          onChange={(e) => setDropRatings(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-beam"
        />
        <span className="min-w-0">
          <span className="block text-[14px] text-paper">Import without the ratings</span>
          <span className="mt-0.5 block text-[12.5px] text-ash">
            Everything still lands in your diary and counts as watched. The scores are left
            behind, so you can rate it all again here from scratch.
          </span>
        </span>
      </label>

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={handleCommit}
          disabled={busy}
          className="rounded-card bg-paper px-4 py-1.5 text-sm font-medium text-carbon hover:bg-white disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import"}
        </button>
        <span className="text-sm text-ash">Nothing changes until you import.</span>
      </div>
      {error && <p className="mt-3 text-sm text-warn">{error}</p>}
    </div>
  );
}

function PreviewList({
  rows,
  matches,
  corrections,
  skips,
}: {
  rows: ImportRow[];
  matches: Record<string, Match | null>;
  corrections: Record<string, Match>;
  skips: Set<string>;
}) {
  const preview = rows.slice(0, 50);
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-sm text-ash">
        Preview{rows.length > preview.length ? `: first ${preview.length} of ${rows.length} rows` : ""}
      </h3>
      <ul className="divide-y divide-seam border-y border-seam">
        {preview.map((r) => {
          const k = filmKey(r);
          const match = corrections[k] ?? matches[k];
          const skipped = skips.has(k) || (!match && matches[k] === null && !corrections[k]);
          const poster = posterUrl(match?.posterPath ?? null, "w154");
          return (
            <li key={r.key} className={`flex items-center gap-3 py-1.5 ${skipped ? "opacity-40" : ""}`}>
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" loading="lazy" className="h-9 w-6 rounded-[2px] object-cover bg-tray" />
              ) : (
                <span className="h-9 w-6 rounded-[2px] bg-tray" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-paper">
                {match?.title ?? r.name}
                <span className="num text-ash"> {match?.year ?? r.year ?? ""}</span>
              </span>
              <span className="text-xs text-ash">{r.kind === "watchlist" ? "watchlist" : r.watchedOn ?? ""}</span>
              <span className="num w-9 text-right text-sm text-paper">
                {r.rating !== null ? formatTenths(r.rating) : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MatchFixer({
  name,
  year,
  onPick,
  onSkip,
}: {
  name: string;
  year: number | null;
  onPick: (m: Match) => void;
  onSkip: () => void;
}) {
  const [q, setQ] = useState(name);
  const [results, setResults] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);

  async function search() {
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  return (
    <li className="rounded-card bg-carbon p-3">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-sm text-paper">
          {name} <span className="num text-ash">{year ?? ""}</span>
        </span>
        <button type="button" onClick={onSkip} className="text-xs text-ash hover:text-warn">
          Skip
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          aria-label={`Search TMDB for ${name}`}
          className="min-w-0 flex-1 rounded-card border border-seam bg-tray px-2 py-1 text-sm focus:border-beam focus:outline-none"
        />
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="rounded-card border border-seam px-3 py-1 text-sm text-ash hover:text-paper disabled:opacity-50"
        >
          Search
        </button>
      </div>
      {results.length > 0 && (
        <ul className="mt-2 space-y-1">
          {results.slice(0, 4).map((r) => {
            const poster = posterUrl(r.posterPath, "w154");
            return (
              <li key={r.tmdbId}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  className="flex w-full items-center gap-2 rounded-card px-2 py-1 text-left hover:bg-tray-2"
                >
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt="" className="h-9 w-6 rounded-[2px] object-cover bg-tray" />
                  ) : (
                    <span className="h-9 w-6 rounded-[2px] bg-tray" aria-hidden />
                  )}
                  <span className="truncate text-sm text-paper">{r.title}</span>
                  <span className="num text-xs text-ash">{r.year ?? ""}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
