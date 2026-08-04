import Link from "next/link";
import PosterImg from "./PosterImg";
import { formatTenths, ratingColor } from "@/lib/format";
import type { RecentViewing } from "@/lib/library";

/**
 * The last few viewings, on the homepage beside the taste card.
 *
 * The card says who someone is; this says what they have actually been doing,
 * which nothing else on this page shows — the deck below is films they haven't
 * seen and the board below is everyone else's. One row per viewing rather than
 * per film, so a rewatch keeps its own line here exactly as it does in the
 * diary.
 *
 * A server component: every row is a link, nothing here opens or expands, so
 * none of it needs JavaScript.
 */
export default function RecentViewings({
  viewings,
  className = "",
}: {
  viewings: RecentViewing[];
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-edge bg-lift p-5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.12em] text-ash">Recent viewings</span>
        {viewings.length > 0 && (
          <Link href="/diary" className="text-[12px] text-beam hover:underline">
            Open diary &rarr;
          </Link>
        )}
      </div>

      {viewings.length === 0 ? <EmptyRecord /> : <ViewingList viewings={viewings} />}
    </div>
  );
}

/**
 * Nothing logged yet. It names the two ways in rather than congratulating the
 * reader on being new: the search sits directly above this panel, and an
 * import is the realistic first session for anyone arriving from elsewhere.
 */
function EmptyRecord() {
  return (
    <div className="mt-4">
      <p className="display text-[17px] leading-snug text-paper">
        No viewings yet.
      </p>
      <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-ash">
        Log the last film you watched and it lands here, rating or not. A rating is never
        required to keep the record.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm text-ash">
          Name one in the search above, or{" "}
          <Link href="/import" className="text-beam underline underline-offset-4">
            import an existing diary
          </Link>
          .
        </span>
      </div>
    </div>
  );
}

function ViewingList({ viewings }: { viewings: RecentViewing[] }) {
  return (
    <ul className="mt-3">
      {viewings.map((v) => (
        <li key={v.entryId} className="border-t border-seam first:border-t-0">
          <Link
            href={`/film/${v.slug}`}
            className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-[rgba(255,255,255,.02)]"
          >
            <PosterImg
              posterPath={v.posterPath}
              title={v.title}
              size="w154"
              sizes="34px"
              className="h-[51px] w-[34px] shrink-0 rounded-[3px] object-cover"
            />

            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1.5">
                <span className="truncate text-[13px] text-paper group-hover:text-white">
                  {v.title}
                </span>
                {v.year !== null && (
                  <span className="num shrink-0 text-[11px] text-dim">{v.year}</span>
                )}
              </span>
              <span className="mt-0.5 flex items-center gap-2 text-[11px] text-ash">
                <span className="num">{dateLabel(v.watchedOn)}</span>
                {v.rewatch && <Tag>Rewatch</Tag>}
                {v.hasReview && <Tag>Review</Tag>}
              </span>
            </span>

            {/* An unrated viewing is a real state, not a gap to apologise for:
                the product lets anyone log without rating, so it prints as a
                quiet dash rather than a prompt. */}
            {v.rating === null ? (
              <span className="num shrink-0 text-[15px] text-dim" title="Watched, not rated">
                &ndash;
              </span>
            ) : (
              <span className={`num shrink-0 text-[17px] leading-none ${ratingColor(v.rating)}`}>
                {formatTenths(v.rating)}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-seam px-1.5 py-px text-[10px] text-dim">
      {children}
    </span>
  );
}

/**
 * A short absolute date, never "Today".
 *
 * This renders on the server, so a relative label would be computed against
 * the server's clock and read a day wrong for anyone far enough away. An
 * absolute date is right in every timezone.
 */
function dateLabel(watchedOn: string | null): string {
  if (!watchedOn) return "No date";
  const [y, m, d] = watchedOn.split("-").map(Number);
  if (!y || !m || !d) return "No date";
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const thisYear = new Date().getFullYear();
  return y === thisYear ? `${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]} ${y}`;
}
