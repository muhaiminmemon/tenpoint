"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, CaretRight } from "@phosphor-icons/react/ssr";
import LogSheet, { type LogPayload } from "./LogSheet";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const rated = seasons.filter((s) => s.rating !== null).length;

  async function submit(payload: LogPayload) {
    if (!active || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId: active.id, ...payload, rewatch: false }),
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
      // The row's own rating, the seasons average and the show's ladder all
      // read the same entry, so the page is refetched rather than patched.
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
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
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setActive(s)}
                disabled={s.unaired}
                className="group flex w-full items-center gap-4 border-b border-seam px-1 py-3.5 text-left transition-colors last:border-0 hover:bg-tray focus-visible:bg-tray focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
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
            </li>
          ))}
        </ul>
      )}

      {active && (
        <LogSheet
          open
          onClose={() => setActive(null)}
          film={{
            title: `${showName}: ${active.label}`,
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
              ? { watchedOn: null, rating: active.rating, review: null, spoiler: false, private: false }
              : undefined
          }
          mode={active.rating !== null ? "edit" : "log"}
        />
      )}
    </div>
  );
}
