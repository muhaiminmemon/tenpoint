"use client";

import { useEffect, useRef, useState } from "react";
import { usePresence } from "@/lib/usePresence";
import { formatTenths, parseRatingInput, RATING_ANCHORS } from "@/lib/format";

type Props = {
  /** current value in tenths (10..100), or null for no rating */
  value: number | null;
  onCommit: (tenths: number) => void;
  busy?: boolean;
};

/**
 * The rating dial. One tap on an integer records n.0, and that's it. The decimal
 * strip beneath is optional refinement. Full keyboard entry: type 8.7, Enter.
 */
export default function RatingDial({ value, onCommit, busy }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [showAnchors, setShowAnchors] = useState(false);
  const anchors = usePresence(showAnchors, 130);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // first-time users see what the numbers mean
    const t = setTimeout(() => {
      if (!window.localStorage.getItem("bb_anchors_seen")) {
        setShowAnchors(true);
        window.localStorage.setItem("bb_anchors_seen", "1");
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const intPart = value === null ? null : Math.floor(value / 10);
  const decPart = value === null ? null : value % 10;
  const display = draft !== null ? draft : value === null ? "" : formatTenths(value);

  function commitDraft() {
    if (draft === null) return;
    const parsed = parseRatingInput(draft);
    setDraft(null);
    if (parsed !== null && parsed !== value) onCommit(parsed);
  }

  function nudge(delta: number) {
    const base = value ?? 70;
    const next = Math.min(100, Math.max(10, base + delta));
    if (next !== value) onCommit(next);
  }

  return (
    <div role="group" aria-label="Rating" className="w-full max-w-sm">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-2">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            aria-label="Rating, 1.0 to 10.0"
            placeholder=""
            value={display}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // blur alone commits; calling commitDraft here too would fire
                // onCommit twice off the same stale draft, logging the film twice
                inputRef.current?.blur();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                nudge(1);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                nudge(-1);
              }
            }}
            className="num w-[4.2ch] bg-transparent text-5xl font-medium text-paper placeholder:text-seam caret-beam focus:outline-none"
          />
          <span className="text-ash text-sm mb-1">/ 10</span>
        </div>
        <button
          type="button"
          onClick={() => setShowAnchors((s) => !s)}
          aria-expanded={showAnchors}
          aria-label="What the numbers mean"
          className="text-ash hover:text-paper text-sm size-6 rounded-full border border-seam leading-none"
        >
          ?
        </button>
      </div>

      {anchors.rendered && (
        <dl
          className={`${anchors.state === "out" ? "pop-out" : "pop-in"} mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-card border border-seam bg-tray p-3 text-sm`}
        >
          {RATING_ANCHORS.map((a) => (
            <div key={a.range} className="contents">
              <dt className="num text-paper">{a.range}</dt>
              <dd className="text-ash">{a.meaning}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="grid grid-cols-10 gap-1" role="group" aria-label="Whole number">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            aria-label={`Rate ${n}.0`}
            aria-pressed={intPart === n}
            onClick={() => onCommit(n * 10)}
            className={`num h-9 rounded-card text-sm transition-colors ${
              intPart === n
                ? "bg-paper text-carbon font-medium"
                : "bg-tray text-paper hover:bg-tray-2"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <div
        className={`mt-1 grid grid-cols-10 gap-1 transition-opacity ${
          intPart === null ? "opacity-40 pointer-events-none" : ""
        }`}
        role="group"
        aria-label="Decimal"
      >
        {Array.from({ length: 10 }, (_, i) => i).map((d) => {
          const disabled = busy || intPart === null || (intPart === 10 && d > 0);
          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              aria-label={`Refine to ${intPart ?? "?"}.${d}`}
              aria-pressed={decPart === d && intPart !== null}
              onClick={() => intPart !== null && onCommit(intPart * 10 + d)}
              className={`num h-7 rounded-card text-xs transition-colors ${
                decPart === d && intPart !== null
                  ? "bg-paper text-carbon font-medium"
                  : "bg-tray text-ash hover:bg-tray-2 hover:text-paper"
              } ${disabled ? "opacity-40" : ""}`}
            >
              .{d}
            </button>
          );
        })}
      </div>

    </div>
  );
}
