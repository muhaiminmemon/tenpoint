"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkSimple, CaretDown, CaretRight } from "@phosphor-icons/react/ssr";
import LogSheet, { type LogPayload } from "./LogSheet";
import { useConfirm } from "./Confirm";
import { useToast } from "./Toast";
import { formatTenths, ratingColor } from "@/lib/format";
import { errorFrom, readJson } from "@/lib/http";

export type SeasonItem = {
  id: string;
  slug: string;
  label: string;
  episodes: number | null;
  year: number | null;
  posterPath: string | null;
  /** the crowd's average for this season, in tenths */
  audience: number | null;
  /** the viewer's own rating, in tenths */
  rating: number | null;
  /** the entry behind that rating, so it can be removed */
  entryId: string | null;
  /** already queued, so the row offers to remove rather than add */
  inWatchlist: boolean;
  unaired: boolean;
};

/**
 * Rating a series season by season, without leaving the page.
 *
 * Each row used to be a link to that season's own page, which meant rating a
 * six-season show was six navigations and six trips back. Rating anything else
 * here opens a sheet from the side; there is no reason a season should be the
 * one thing that throws you somewhere else to do it.
 *
 * The list is closed by default. Most people have one opinion about a show and
 * the whole panel above answers that; opening this is a deliberate act by
 * somebody who thinks season four was the good one, so it asks first rather
 * than presenting eight rows to everybody.
 */
export default function SeasonRater({
  seasons,
  showName,
  open: initiallyOpen = false,
}: {
  seasons: SeasonItem[];
  showName: string;
  open?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [active, setActive] = useState<SeasonItem | null>(null);
  /**
   * Whether the open sheet is a rewatch rather than a first viewing or an edit.
   *
   * Seasons could only ever be logged once: this component posted rewatch
   * false unconditionally, so watching a season again either overwrote what
   * you thought the first time or was refused. A film has had rewatches since
   * the beginning, and a season is the same unit of watching.
   */
  const [again, setAgain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();

  const rated = seasons.filter((s) => s.rating !== null).length;

  async function submit(payload: LogPayload) {
    if (!active || busy) return;
    setBusy(true);
    setError(null);
    /**
     * Changing your mind edits the viewing; watching it again logs a new one.
     *
     * Both used to post a new entry, so a corrected score was indistinguishable
     * from a rewatch and inflated every count built on viewings. "Again" is the
     * control that means a second viewing, and it is the only one that writes
     * a second row.
     */
    const editing = !again && active.rating !== null && active.entryId !== null;
    try {
      const res = await fetch(editing ? `/api/entries/${active.entryId}` : "/api/entries", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing ? payload : { filmId: active.id, ...payload, rewatch: again },
        ),
      });
      if (!res.ok) {
        setError(await errorFrom(res, "That didn't save. Try again."));
        return;
      }
      await readJson(res);
      toast({
        message:
          payload.rating !== null
            ? `${active.label} rated ${formatTenths(payload.rating)}`
            : `${active.label} logged`,
      });
      setActive(null);
      setAgain(false);
      // The row's own rating, the seasons average and the show's ladder all
      // read the same entry, so the page is refetched rather than patched.
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Queueing a single season.
   *
   * Watchlisting the whole series says you mean to start it; this says you
   * mean to get to season four, which is a different sentence and the one a
   * part-way viewer actually needs. Seasons are ordinary film rows so the
   * endpoint always accepted them, but nothing on the site could send one.
   */
  async function toggleQueue(s: SeasonItem) {
    const res = await fetch("/api/watchlist", {
      method: s.inWatchlist ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filmId: s.id }),
    });
    if (!res.ok) {
      toast({ message: "That didn't save. Try again." });
      return;
    }
    toast({ message: s.inWatchlist ? `${s.label} removed from watchlist` : `${s.label} on your watchlist` });
    router.refresh();
  }

  async function removeRating(s: SeasonItem) {
    if (!s.entryId) return;
    const ok = await confirm({
      title: `Remove your rating of ${s.label}?`,
      // Names the mechanism rather than only the consequence: ratings you
      // replace are kept, and this is the action that throws them away.
      body: "The whole viewing goes, and with it the rating, anything you wrote alongside it, and any earlier ratings this one replaced. This can't be undone.",
      action: "Remove",
    });
    if (!ok) return;
    const res = await fetch(`/api/entries/${s.entryId}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ message: "That didn't delete. Try again." });
      return;
    }
    toast({ message: `${s.label} rating removed` });
    router.refresh();
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-card text-[13.5px] text-beam transition-colors hover:text-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-beam-edge"
      >
        {open ? "Hide seasons" : "Rate by seasons"}
        <span className="num text-[12px] text-dim">
          {rated > 0 ? `${rated} of ${seasons.length} rated` : `${seasons.length}`}
        </span>
        <CaretDown
          aria-hidden
          className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul className="fade-up mt-3 border-t border-seam">
          {seasons.map((s) => (
            <li key={s.id} className="flex items-center border-b border-seam last:border-0">
              <button
                type="button"
                onClick={() => {
                  setAgain(false);
                  setActive(s);
                }}
                disabled={s.unaired}
                className="group flex min-w-0 flex-1 items-center gap-4 px-1 py-3.5 text-left transition-colors hover:bg-tray focus-visible:bg-tray focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-paper">{s.label}</span>
                  <span className="num mt-0.5 block text-[12px] text-ash">
                    {[
                      s.year,
                      s.episodes ? `${s.episodes} ${s.episodes === 1 ? "episode" : "episodes"}` : null,
                      s.unaired ? "Not aired yet" : null,
                    ]
                      .filter(Boolean)
                      .join("  ·  ")}
                  </span>
                </span>

                {/* The crowd first, then you. Same order as a film page, so the
                    eye learns one place to look for each. */}
                {s.audience !== null && (
                  <span className="num shrink-0 text-[12.5px] text-dim">
                    {formatTenths(s.audience)}
                  </span>
                )}
                {s.rating !== null ? (
                  <span className={`num shrink-0 text-[19px] ${ratingColor(s.rating)}`}>
                    {formatTenths(s.rating)}
                  </span>
                ) : (
                  <span className="shrink-0 text-[12.5px] text-dim opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    Rate
                  </span>
                )}
                <CaretRight aria-hidden className="size-3.5 shrink-0 text-dim" />
              </button>

              {/* Watching it again and changing your mind are different acts,
                  so they get different controls. Shown only once a rating
                  exists, because neither means anything before one. */}
              {/* Queueing works whether or not it has been rated: the point of
                  it is the season you have not got to yet. */}
              {!s.unaired && (
                <button
                  type="button"
                  onClick={() => toggleQueue(s)}
                  aria-pressed={s.inWatchlist}
                  aria-label={
                    s.inWatchlist
                      ? `Remove ${s.label} from your watchlist`
                      : `Add ${s.label} to your watchlist`
                  }
                  className={`shrink-0 rounded-card px-2 py-1 transition-colors focus-visible:outline-none ${
                    s.inWatchlist ? "text-beam" : "text-dim hover:text-paper focus-visible:text-paper"
                  }`}
                >
                  <BookmarkSimple
                    aria-hidden
                    weight={s.inWatchlist ? "fill" : "regular"}
                    className="size-4"
                  />
                </button>
              )}

              {s.rating !== null && (
                <span className="flex shrink-0 items-center gap-1 pl-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAgain(true);
                      setActive(s);
                    }}
                    className="rounded-card px-2 py-1 text-[12px] text-dim transition-colors hover:text-paper focus-visible:text-paper focus-visible:outline-none"
                  >
                    Again
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRating(s)}
                    className="rounded-card px-2 py-1 text-[12px] text-dim transition-colors hover:text-paper focus-visible:text-paper focus-visible:outline-none"
                  >
                    Remove
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {active && (
        <LogSheet
          open
          onClose={() => {
            setActive(null);
            setAgain(false);
          }}
          film={{
            title: `${showName}: ${active.label}`,
            year: active.year,
            director: null,
            posterPath: active.posterPath,
          }}
          isRewatch={again}
          busy={busy}
          error={error}
          onSubmit={submit}
          initial={
            // A rewatch opens empty. It is a new viewing rather than a
            // correction of the old one, and prefilling the previous score is
            // how a rewatch quietly turns back into an edit.
            active.rating !== null && !again
              ? { watchedOn: null, rating: active.rating, review: null, spoiler: false, private: false }
              : undefined
          }
          mode={active.rating !== null && !again ? "edit" : "log"}
        />
      )}
    </div>
  );
}
