"use client";

import { formatTenths, ratingColor } from "@/lib/format";

export type Viewing = {
  id: string;
  watchedOn: string | null;
  rating: number | null;
  rewatch: boolean;
  review: string | null;
  spoiler: boolean;
  private: boolean;
  createdAt: string;
  /**
   * Every rating this viewing carried before the one it carries now, oldest
   * first. Empty for a verdict that never moved.
   */
  ratingHistory?: number[];
};

type Props = {
  viewing: Viewing;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

function dateLabel(v: Viewing): string {
  if (!v.watchedOn) return "No date";
  const [y, m, d] = v.watchedOn.split("-").map(Number);
  const when = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - when.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return when.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: when.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/** A viewing you can read at a glance, with Edit/Delete always visible as real buttons. */
export default function ViewingCard({ viewing, busy, onEdit, onDelete }: Props) {
  return (
    <li className="flex items-start gap-3.5 rounded-lg border border-seam bg-lift px-3.5 py-3">
      <div className="w-11 shrink-0 text-center">
        <span className={`num text-[19px] ${ratingColor(viewing.rating)}`}>
          {viewing.rating === null ? "" : formatTenths(viewing.rating)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num text-[13px] text-paper">{dateLabel(viewing)}</span>
          {viewing.rewatch && (
            <span className="rounded-full border border-beam-edge px-1.5 py-px text-[11px] text-beam">
              rewatch
            </span>
          )}
          {viewing.private && (
            <span className="rounded-full border border-seam px-1.5 py-px text-[11px] text-dim">
              only me
            </span>
          )}
        </div>
        {/* How the verdict moved on this one viewing.
            Not a rewatch and not a second viewing: the same night, reconsidered.
            The chain ends on the rating printed large to the left, so the two
            always agree about what the current number is. */}
        {viewing.ratingHistory && viewing.ratingHistory.length > 0 && viewing.rating !== null && (
          <p className="num mt-1 text-[11px] text-dim">
            <span className="sr-only">
              You changed this rating{" "}
              {viewing.ratingHistory.length === 1
                ? "once"
                : `${viewing.ratingHistory.length} times`}
              :{" "}
            </span>
            {[...viewing.ratingHistory, viewing.rating].map((r, i, all) => (
              <span key={i}>
                {/* The chain already reads left to right in the order it
                    happened, so it needs a separator rather than a direction.
                    The same middle dot every other row in the app separates
                    facts with. */}
                {i > 0 && <span className="px-1.5 text-seam">·</span>}
                <span className={i === all.length - 1 ? ratingColor(r) : undefined}>
                  {formatTenths(r)}
                </span>
              </span>
            ))}
          </p>
        )}
        {viewing.review && (
          <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-ash">
            {viewing.spoiler ? "Mentions plot details." : viewing.review}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="rounded-card border border-seam px-2.5 py-1.5 text-xs text-ash hover:text-paper disabled:opacity-50"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="rounded-card border border-seam px-2.5 py-1.5 text-xs text-ash hover:border-warn hover:text-warn disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
