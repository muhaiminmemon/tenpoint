"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown, CaretLeft } from "@phosphor-icons/react/ssr";
import Sheet from "./Sheet";
import PosterImg from "./PosterImg";
import RatingGrid from "./RatingGrid";
import { formatTenths, todayLocalISO } from "@/lib/format";
import type { SearchResult } from "@/app/api/search/route";

export type PlaceFilm = {
  tmdbId: number;
  kind: "movie" | "show";
  title: string;
  year: number | null;
  posterPath: string | null;
};

export type PlacePayload = {
  film: PlaceFilm;
  /** null when the gap decides it */
  rating: number | null;
  watchedOn: string | null;
  review: string | null;
  spoiler: boolean;
  private: boolean;
};

/**
 * The whole flow for one gap: find the title, then log it.
 *
 * Two steps in one panel rather than two panels, because the gap is the context
 * for both halves and handing the reader off to a second sheet would drop it.
 */
export default function PlaceSheet({
  open,
  onClose,
  suggested,
  between,
  busy,
  error,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  /** the rating read off the titles around the gap, before any override */
  suggested: number | null;
  /** what sits either side, so the sheet can say where this is going */
  between: { above: string | null; below: string | null };
  busy: boolean;
  error: string | null;
  onSubmit: (payload: PlacePayload) => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<PlaceFilm | null>(null);
  const [override, setOverride] = useState<number | null>(null);
  const [date, setDate] = useState<"today" | "yesterday" | "none">("today");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [review, setReview] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  /** cleared as the sheet closes, so the next gap never opens on the last one's search */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setTerm("");
      setResults([]);
      setPicked(null);
      setOverride(null);
      setDate("today");
      setReviewOpen(false);
      setReview("");
      setSpoiler(false);
      setIsPrivate(false);
    }
  }

  useEffect(() => {
    if (open && !picked) input.current?.focus();
  }, [open, picked]);

  const q = term.trim();
  /** a stale list from a longer term must not show under a shorter one */
  const shown = q.length < 2 ? [] : results;

  useEffect(() => {
    const term2 = term.trim();
    if (term2.length < 2) return;
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term2)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { results?: SearchResult[] };
        setResults((data.results ?? []).slice(0, 8));
      } catch {
        /* aborted or offline; the previous list stays */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [term]);

  const rating = override ?? suggested;

  function watchedOn(): string | null {
    if (date === "none") return null;
    if (date === "today") return todayLocalISO();
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return todayLocalISO(d);
  }

  function submit() {
    if (!picked) return;
    onSubmit({
      film: picked,
      rating: override,
      watchedOn: watchedOn(),
      review: review.trim() || null,
      spoiler,
      private: isPrivate,
    });
  }

  const gap =
    between.above && between.below
      ? `Between ${between.above} and ${between.below}`
      : between.below
        ? `Above ${between.below}`
        : between.above
          ? `Below ${between.above}`
          : "";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={picked ? "Log a viewing" : "What goes here?"}
      subtitle={<span className="text-xs text-ash">{gap}</span>}
    >
      {!picked ? (
        <>
          <input
            ref={input}
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search a film or series"
            aria-label="Search a film or series"
            className="mt-4.5 w-full rounded-card border border-seam bg-carbon px-3 py-2 text-sm placeholder:text-dim focus:border-beam focus:outline-none"
          />
          <div className="mt-3">
            {q.length < 2 ? (
              <p className="py-6 text-sm text-ash">Type a title to find it.</p>
            ) : shown.length === 0 ? (
              <p className="py-6 text-sm text-ash">
                {loading ? "Searching…" : "Nothing by that name."}
              </p>
            ) : (
              <ul>
                {shown.map((r) => {
                  const already = r.rating !== null && r.rating !== undefined;
                  return (
                    <li key={`${r.kind ?? "movie"}-${r.tmdbId}`}>
                      <button
                        type="button"
                        disabled={already}
                        onClick={() =>
                          setPicked({
                            tmdbId: r.tmdbId,
                            kind: r.kind === "show" ? "show" : "movie",
                            title: r.title,
                            year: r.year,
                            posterPath: r.posterPath,
                          })
                        }
                        className="flex w-full items-center gap-3 rounded-card px-1.5 py-2 text-left transition-colors hover:bg-tray disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                      >
                        <PosterImg
                          posterPath={r.posterPath}
                          title={r.title}
                          size="w154"
                          sizes="34px"
                          className="h-[51px] w-[34px] shrink-0 rounded-[3px] object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-paper">{r.title}</span>
                          <span className="num block truncate text-xs text-ash">
                            {[r.year, r.kind === "show" ? "Series" : r.director]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        {already && (
                          <span className="num shrink-0 text-xs text-dim">
                            rated {formatTenths(r.rating!)}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mt-4.5 flex items-center gap-2.5">
            <PosterImg
              posterPath={picked.posterPath}
              title={picked.title}
              size="w154"
              sizes="34px"
              className="h-[51px] w-[34px] shrink-0 rounded-[3px] object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-paper">{picked.title}</div>
              <div className="num truncate text-xs text-ash">{picked.year ?? ""}</div>
            </div>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="flex items-center gap-1 text-xs text-beam hover:underline"
            >
              <CaretLeft aria-hidden weight="bold" className="size-3" />
              Change
            </button>
          </div>

          <div className="mt-4.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] uppercase tracking-[0.14em] text-ash">Rating</span>
              {override !== null && (
                <button
                  type="button"
                  onClick={() => setOverride(null)}
                  className="text-xs text-beam hover:underline"
                >
                  Use the gap
                </button>
              )}
            </div>
            <div className="mt-2">
              <RatingGrid value={rating} onChange={setOverride} disabled={busy} size="sm" />
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ash">
              {override !== null
                ? "Your number, not the gap's."
                : rating === null
                  ? "Nothing either side to read a rating from. Pick one above."
                  : "Read off the two titles above this gap and the two below it."}
            </p>
          </div>

          <div className="mt-4.5">
            <span className="text-[11px] uppercase tracking-[0.14em] text-ash">Watched</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["today", "yesterday", "none"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDate(k)}
                  aria-pressed={date === k}
                  className={`rounded-card px-3 py-1.5 text-[13px] transition-colors ${
                    date === k
                      ? "bg-paper text-carbon"
                      : "border border-seam bg-tray text-ash hover:text-paper"
                  }`}
                >
                  {k === "today" ? "Today" : k === "yesterday" ? "Yesterday" : "No date"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4.5 rounded-card border border-seam bg-carbon">
            <button
              type="button"
              onClick={() => setReviewOpen((o) => !o)}
              aria-expanded={reviewOpen}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <span className="text-[13px] text-paper">
                {review.trim() ? "Review" : "Write a review"}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-beam">
                {reviewOpen ? "Collapse" : "Expand"}
                <CaretDown
                  aria-hidden
                  className={`size-3 transition-transform ${reviewOpen ? "rotate-180" : ""}`}
                />
              </span>
            </button>
            {reviewOpen && (
              <div className="px-3 pb-3">
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  rows={4}
                  maxLength={20000}
                  aria-label="Review"
                  placeholder="What stayed with you?"
                  className="w-full border-t border-seam bg-transparent pt-2.5 text-[13px] leading-relaxed text-paper placeholder:text-dim focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ash">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={spoiler}
                      onChange={(e) => setSpoiler(e.target.checked)}
                    />
                    Mentions plot details
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                    />
                    Only me
                  </label>
                </div>
              </div>
            )}
          </div>

          {error && <p className="mt-3 text-sm text-warn">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="display mt-4.5 w-full rounded-card bg-paper py-2.5 text-[15px] font-medium text-carbon hover:bg-white disabled:opacity-50"
          >
            {busy ? "Saving…" : rating === null ? "Log without a rating" : `Log · ${formatTenths(rating)}`}
          </button>
        </>
      )}
    </Sheet>
  );
}
