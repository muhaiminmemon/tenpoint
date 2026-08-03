"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react/ssr";
import Sheet from "./Sheet";
import RatingGrid from "./RatingGrid";
import PosterImg from "./PosterImg";
import { formatTenths, todayLocalISO } from "@/lib/format";

export type LogPayload = {
  watchedOn: string | null;
  rating: number | null;
  review: string | null;
  spoiler: boolean;
  private: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  film: { title: string; year: number | null; director: string | null; posterPath: string | null };
  /** true when there's already a prior viewing, so the copy says "rewatch" */
  isRewatch: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (payload: LogPayload) => void;
  /** prefilled when editing an existing viewing rather than logging a new one */
  initial?: LogPayload;
  mode?: "log" | "edit";
};

function yesterdayLocalISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayLocalISO(d);
}

type DateChoice = "today" | "yesterday" | "pick" | "none";

export default function LogSheet({
  open,
  onClose,
  film,
  isRewatch,
  busy,
  error,
  onSubmit,
  initial,
  mode = "log",
}: Props) {
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [choice, setChoice] = useState<DateChoice>(() => {
    if (!initial) return "today";
    if (!initial.watchedOn) return "none";
    if (initial.watchedOn === todayLocalISO()) return "today";
    if (initial.watchedOn === yesterdayLocalISO()) return "yesterday";
    return "pick";
  });
  const [picked, setPicked] = useState(initial?.watchedOn ?? todayLocalISO());
  const [reviewOpen, setReviewOpen] = useState(Boolean(initial?.review));
  const [review, setReview] = useState(initial?.review ?? "");
  const [spoiler, setSpoiler] = useState(initial?.spoiler ?? false);
  const [isPrivate, setIsPrivate] = useState(initial?.private ?? false);

  function watchedOn(): string | null {
    if (choice === "none") return null;
    if (choice === "today") return todayLocalISO();
    if (choice === "yesterday") return yesterdayLocalISO();
    return picked;
  }

  function submit(overrideRating?: number) {
    onSubmit({
      watchedOn: watchedOn(),
      rating: overrideRating ?? rating,
      review: review.trim() || null,
      spoiler,
      private: isPrivate,
    });
  }

  const dateChips: { key: DateChoice; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "pick", label: "Pick a date" },
    { key: "none", label: "No date" },
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit viewing" : isRewatch ? "Log a rewatch" : "Log a viewing"}
      subtitle={
        <div className="flex items-center gap-2.5">
          <PosterImg
            posterPath={film.posterPath}
            title={film.title}
            size="w154"
            sizes="30px"
            className="w-[30px] shrink-0 rounded-[4px]"
          />
          <div className="min-w-0">
            <div className="truncate text-sm text-paper">{film.title}</div>
            <div className="num truncate text-xs text-ash">
              {[film.year, film.director].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      }
    >
      <div className="mt-4.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.14em] text-ash">Your rating</span>
          <span className="text-xs text-beam">Tap a number, then log</span>
        </div>
        <div className="mt-2">
          <RatingGrid
            value={rating}
            onChange={setRating}
            onQuickCommit={(t) => {
              setRating(t);
              submit(t);
            }}
            disabled={busy}
          />
        </div>
      </div>

      <div className="mt-4.5">
        <span className="text-[11px] uppercase tracking-[0.14em] text-ash">Watched</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dateChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setChoice(c.key)}
              aria-pressed={choice === c.key}
              className={`rounded-card px-3 py-1.5 text-[13px] transition-colors ${
                choice === c.key
                  ? "bg-paper text-carbon"
                  : "border border-seam bg-tray text-ash hover:text-paper"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {choice === "pick" && (
          <input
            type="date"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            aria-label="Date watched"
            className="mt-2 rounded-card border border-seam bg-carbon px-2.5 py-1.5 text-sm"
          />
        )}
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
        onClick={() => submit()}
        disabled={busy}
        className="display mt-4.5 w-full rounded-card bg-paper py-2.5 text-[15px] font-medium text-carbon hover:bg-white disabled:opacity-50"
      >
        {busy
          ? "Saving…"
          : mode === "edit"
            ? "Save changes"
            : rating !== null
              ? `Log · ${formatTenths(rating)}`
              : "Log without a rating"}
      </button>
      <p className="mt-2.5 text-center text-xs text-ash">
        {mode === "edit"
          ? "Changes apply to this viewing only."
          : "Stays on the film. We'll confirm with a toast."}
      </p>
    </Sheet>
  );
}
