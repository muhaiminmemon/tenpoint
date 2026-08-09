"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sheet from "./Sheet";
import LogSheet, { type LogPayload } from "./LogSheet";
import { useConfirm } from "./Confirm";
import { useToast } from "./Toast";
import { formatTenths, ratingColor } from "@/lib/format";
import { errorFrom, readJson } from "@/lib/http";
import type { LibrarySeason, LibrarySeries } from "@/lib/library";

/**
 * A series opened out of the shelf, season by season.
 *
 * The library lists one row per work, which for television means the seasons
 * have to live somewhere. They live here rather than on the shelf itself: the
 * ranked list answers what did you think of this, and only somebody who thinks
 * season four was the good one needs the breakdown, so it is one tap away
 * instead of thirty-eight rows in everyone's way.
 *
 * It is also where a series is carried on. Rating the season you watched last
 * night from your own shelf is the single most repeated act a television
 * viewer performs here, and sending them to another page to do it was the
 * reason the season list on the series page exists at all.
 */

/** Where the one number on the row came from, said rather than implied. */
function scoreOf(series: LibrarySeries): { value: number; source: string } | null {
  if (series.wholeRating !== null) {
    return { value: series.wholeRating, source: "your whole-series rating" };
  }
  if (series.meanRating !== null) {
    const n = series.ratedSeasons;
    return { value: series.meanRating, source: `mean of ${n} ${n === 1 ? "season" : "seasons"}` };
  }
  return null;
}

export function seriesStanding(series: LibrarySeries): string {
  if (series.state === "finished") return "Finished";
  if (series.state === "caughtup") return "Caught up";
  if (series.totalSeasons === 0) return "In progress";
  return `${series.credited} of ${series.totalSeasons} seasons`;
}

export default function SeriesSheet({
  series,
  editable,
  onClose,
}: {
  series: LibrarySeries;
  editable: boolean;
  onClose: () => void;
}) {
  const [active, setActive] = useState<LibrarySeason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();

  const score = scoreOf(series);
  const pct =
    series.totalSeasons > 0
      ? Math.min(100, (series.credited / series.totalSeasons) * 100)
      : 0;

  async function submit(payload: LogPayload) {
    if (!active || busy) return;
    setBusy(true);
    setError(null);
    /**
     * Correcting a score edits the viewing; it does not log another one.
     *
     * Posting a new entry was how this used to save an edit, which made
     * changing 8.0 to 8.5 read as having watched the season twice, and every
     * count built on viewings believed it. Watching a season again is a diary
     * act and belongs on the series page with the rest of the record.
     */
    const editing = active.rating !== null && active.entryId !== null;
    try {
      const res = await fetch(
        editing ? `/api/entries/${active.entryId}` : "/api/entries",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing ? payload : { filmId: active.filmId, ...payload, rewatch: false },
          ),
        },
      );
      if (!res.ok) {
        setError(await errorFrom(res, "That didn't save. Try again."));
        return;
      }
      await readJson(res);
      toast({
        message:
          payload.rating !== null
            ? `${series.name}, ${active.label.toLowerCase()} rated ${formatTenths(payload.rating)}`
            : `${series.name}, ${active.label.toLowerCase()} logged`,
      });
      setActive(null);
      // The season's own score, the series row's score and how far through it
      // says you are all read the same entry, so the page is refetched rather
      // than patched. The panel stays open on fresh data.
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function removeRating(s: LibrarySeason) {
    if (!s.entryId) return;
    const ok = await confirm({
      title: `Remove your rating of ${series.name}, ${s.label.toLowerCase()}?`,
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
    <>
      <Sheet
        open
        onClose={onClose}
        title={series.name}
        subtitle={
          <div className="flex items-start gap-5">
            <div className="min-w-0 flex-1">
              <p className="num text-[12.5px] text-ash">
                {[
                  seriesStanding(series),
                  series.nextSeason !== null ? `next up season ${series.nextSeason}` : null,
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
              {/* The same figure the line above states, at a glance. Drawn
                  only once there is something to draw: an empty track sitting
                  a few pixels off the header rule reads as a second rule, and
                  a bar at nothing communicates nothing the line has not. */}
              {series.credited > 0 && (
                <span
                  aria-hidden
                  className="mt-2.5 block h-[3px] w-full max-w-48 overflow-hidden rounded-sm bg-seam"
                >
                  <span
                    className="block h-full rounded-sm bg-beam transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </span>
              )}
            </div>

            {score && (
              <div className="shrink-0 text-right">
                <div className={`num text-[26px] leading-none ${ratingColor(score.value)}`}>
                  {formatTenths(score.value)}
                </div>
                {/* Which of the two readings this is. One number over five
                    seasons is either a verdict somebody typed or arithmetic
                    over the ones they did, and those are not the same claim. */}
                <div className="mt-1.5 max-w-[15ch] text-balance text-[10px] leading-tight text-dim">
                  {score.source}
                </div>
              </div>
            )}
          </div>
        }
      >
        {series.seasons.length === 0 ? (
          <p className="py-6 text-sm text-ash">
            No seasons are on file for this series yet.
          </p>
        ) : (
          <ul className="mt-1 border-b border-seam">
            {series.seasons.map((s) => (
              <SeasonRow
                key={s.filmId}
                season={s}
                editable={editable}
                onRate={() => setActive(s)}
                onRemove={() => removeRating(s)}
              />
            ))}
          </ul>
        )}

        <Link
          href={`/show/${series.slug}`}
          className="mt-5 inline-flex items-center gap-1.5 rounded-card text-[13.5px] text-beam transition-colors hover:text-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-beam-edge"
        >
          Open the series page
        </Link>
      </Sheet>

      {active && (
        <LogSheet
          open
          onClose={() => setActive(null)}
          film={{
            title: `${series.name}: ${active.label}`,
            year: active.year,
            director: null,
            posterPath: active.posterPath,
          }}
          isRewatch={false}
          busy={busy}
          error={error}
          onSubmit={submit}
          initial={
            active.rating !== null
              ? {
                  watchedOn: null,
                  rating: active.rating,
                  review: null,
                  spoiler: false,
                  private: false,
                }
              : undefined
          }
          mode={active.rating !== null ? "edit" : "log"}
        />
      )}
    </>
  );
}

function SeasonRow({
  season,
  editable,
  onRate,
  onRemove,
}: {
  season: LibrarySeason;
  editable: boolean;
  onRate: () => void;
  onRemove: () => void;
}) {
  const meta = [
    season.year,
    season.episodes ? `${season.episodes} ${season.episodes === 1 ? "episode" : "episodes"}` : null,
    season.unaired ? "not aired yet" : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] text-paper">{season.label}</span>
        <span className="num mt-0.5 block truncate text-[11.5px] text-ash">{meta}</span>
      </span>
      {/* The crowd first, then you, in the order every other surface prints
          them, so the eye learns one place to look for each. */}
      <span className="num w-8 shrink-0 text-right text-[12px] text-dim">
        {season.audience !== null ? formatTenths(season.audience) : ""}
      </span>
      {season.rating !== null ? (
        <span className={`num w-11 shrink-0 text-right text-[19px] ${ratingColor(season.rating)}`}>
          {formatTenths(season.rating)}
        </span>
      ) : (
        // Beam, not dim: the crowd's number sits right beside this, and two
        // identical greys made "7.3 Rate" read as one thing rather than a
        // fact and an invitation. On somebody else's shelf there is no
        // invitation, so the column is simply empty, the way an unrated film
        // is empty in the ledger.
        <span className="w-11 shrink-0 text-right text-[12px] text-beam">
          {editable ? "Rate" : ""}
        </span>
      )}
    </>
  );

  if (!editable) {
    return (
      <li className="flex items-center gap-3.5 border-t border-seam py-3">{body}</li>
    );
  }

  return (
    <li className="group flex items-center border-t border-seam">
      <button
        type="button"
        onClick={onRate}
        disabled={season.unaired}
        aria-label={
          season.rating !== null
            ? `Change your rating of ${season.label}`
            : `Rate ${season.label}`
        }
        className="flex min-w-0 flex-1 items-center gap-3.5 py-3 pr-1 text-left transition-colors hover:bg-tray focus-visible:bg-tray focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
      >
        {body}
      </button>
      {season.rating !== null && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-card px-2 py-1 text-[11.5px] text-dim opacity-0 transition-opacity hover:text-paper focus-visible:text-paper focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100 sm:opacity-0"
        >
          Remove
        </button>
      )}
    </li>
  );
}
