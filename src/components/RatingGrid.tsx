"use client";

import { useRef } from "react";
import { formatTenths } from "@/lib/format";

type Props = {
  /** tenths (10..100), or null for nothing chosen yet */
  value: number | null;
  onChange: (tenths: number) => void;
  /** long-press a whole number to log at n.0 without a second tap */
  onQuickCommit?: (tenths: number) => void;
  disabled?: boolean;
  /** compact spacing for the mobile bottom sheet */
  size?: "md" | "sm";
};

const HOLD_MS = 500;

/**
 * The dial, reduced to its two rows. One tap on a whole number is a complete
 * rating; the decimal strip below is optional refinement.
 */
export default function RatingGrid({
  value,
  onChange,
  onQuickCommit,
  disabled,
  size = "md",
}: Props) {
  const whole = value === null ? null : Math.floor(value / 10);
  const dec = value === null ? null : value % 10;

  // a long press fires the quick commit; the click that follows must not re-fire
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  function startHold(n: number) {
    if (!onQuickCommit || disabled) return;
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      onQuickCommit(n * 10);
    }, HOLD_MS);
  }

  function endHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }

  function pickWhole(n: number) {
    if (held.current) {
      held.current = false;
      return;
    }
    // 10 has no decimals above .0 — drop any carried fraction (e.g. 8.7 -> 10)
    if (n === 10) {
      onChange(100);
      return;
    }
    // keep the decimal when moving between whole numbers, so 8.7 -> 9.7
    onChange(n * 10 + (dec ?? 0));
  }

  const wholeH = size === "sm" ? "h-[30px] text-xs" : "h-[34px] text-[13px]";
  const decH = size === "sm" ? "h-[22px] text-[10px]" : "h-[26px] text-[11px]";
  const gap = size === "sm" ? "gap-[3px]" : "gap-1";

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="num text-4xl font-medium text-paper">
          {value === null ? "" : formatTenths(value)}
        </span>
        <span className="text-[13px] text-ash">/ 10</span>
      </div>

      <div className={`mt-3 grid grid-cols-10 ${gap}`} role="group" aria-label="Whole number">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-label={`Rate ${n}.0`}
            aria-pressed={whole === n}
            onClick={() => pickWhole(n)}
            onPointerDown={() => startHold(n)}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onContextMenu={(e) => e.preventDefault()}
            className={`num ${wholeH} touch-none rounded-card transition-colors disabled:opacity-40 ${
              whole === n
                ? "bg-paper font-medium text-carbon"
                : "bg-tray text-paper hover:bg-tray-2"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <div
        className={`mt-[3px] grid grid-cols-10 ${gap} transition-opacity ${
          whole === null ? "pointer-events-none opacity-40" : ""
        }`}
        role="group"
        aria-label="Decimal"
      >
        {Array.from({ length: 10 }, (_, i) => i).map((d) => {
          // 10 has no decimals above .0
          const off = disabled || whole === null || (whole === 10 && d > 0);
          return (
            <button
              key={d}
              type="button"
              disabled={off}
              aria-label={`Refine to ${whole ?? "?"}.${d}`}
              aria-pressed={dec === d && whole !== null}
              onClick={() => whole !== null && onChange(whole * 10 + d)}
              className={`num ${decH} rounded-card transition-colors ${
                dec === d && whole !== null
                  ? "bg-paper font-medium text-carbon"
                  : "bg-tray text-ash hover:bg-tray-2 hover:text-paper"
              } ${off ? "opacity-40" : ""}`}
            >
              .{d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
