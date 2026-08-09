"use client";

import { Children, useState, type ReactNode } from "react";

/**
 * Renders a list a page at a time.
 *
 * The children are already rendered and already on the client, so this reveals
 * rather than fetches: the count in the button is exact, and clicking it can't
 * fail. Nothing here is hidden from a reader who wants it — the reveal exists
 * so the page has a bottom.
 */
export default function ShowMore({
  children,
  initial,
  step,
  noun,
}: {
  children: ReactNode;
  /** how many to render before the first click */
  initial: number;
  /** how many more each click reveals */
  step: number;
  /** singular, for the button's label — "review" reads as "Show 8 more reviews" */
  noun: string;
}) {
  const items = Children.toArray(children);
  const [shown, setShown] = useState(initial);
  const next = Math.min(step, items.length - shown);

  return (
    <>
      {items.slice(0, shown)}
      {next > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setShown((n) => n + step)}
            className="rounded-card border border-seam px-3 py-1.5 text-sm text-ash transition-colors hover:bg-tray hover:text-paper"
          >
            Show {next} more {next === 1 ? noun : `${noun}s`}
          </button>
        </li>
      )}
    </>
  );
}
