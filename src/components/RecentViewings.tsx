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
 * Full height on purpose: it is a grid item beside the taste card, so it is
 * stretched to whatever the card column is tall, and the list divides that
 * height rather than stopping short and leaving a band of empty panel.
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
    <div className={`flex h-full flex-col rounded-xl border border-edge bg-lift p-4 ${className}`}>
      <div className="flex flex-none items-baseline justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.12em] text-ash">Recent viewings</span>
        {viewings.length > 0 && (
          <Link href="/diary" className="text-[12px] text-beam hover:underline">
            Open diary
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

/**
 * One viewing per line, on columns that hold still.
 *
 * Two things are load-bearing here. The rows each take an equal share of the
 * list's height, so the last one ends exactly at the bottom of the panel
 * instead of leaving a grey band under a short list.
 *
 * And the date and the rating are fixed-width cells rather than flex items.
 * They used to sit in the flow after an optional "Rewatch" tag, which meant
 * every row that happened to be a rewatch pushed its own date and rating
 * leftward and the two columns wandered down the panel. The tags moved in
 * beside the title, where variable width costs nothing: a title is read, not
 * compared. What gets compared — the dates and the tenths — is what gets a
 * column.
 */
/** How many rows a phone gets. The rest are held back until there is room. */
const PHONE_ROWS = 3;

function ViewingList({ viewings }: { viewings: RecentViewing[] }) {
  return (
    <ul className="mt-2 flex min-h-0 flex-1 flex-col">
      {viewings.map((v, i) => (
        // `min-w-0` on every link in the chain, not just the title.
        //
        // A flex item defaults to `min-width: auto`, which is its content's
        // minimum rather than zero, so an item without it refuses to shrink and
        // pushes the row wider than the panel holding it. Only the title span
        // had it, which was enough until a row carried a long title and both
        // tags: the row then measured 640px inside a 368px panel and the date
        // and rating printed outside the box entirely. Shrinking has to be
        // permitted at every step between the panel and the text.
        /**
         * Half the list on a phone, at nearly twice the size.
         *
         * Six rows in a 336px panel is a wall of near-identical lines: the
         * posters are too small to recognise and the titles all truncate at the
         * same place, so it reads as texture rather than as six things you
         * watched. Three rows fit the same space with room to be legible, and
         * the diary link directly above already leads to the full record, so
         * nothing is lost that was not one tap away.
         *
         * Rendered and hidden rather than sliced, because the cut is a
         * viewport question and this is a server component: it cannot know the
         * width, and shipping three rows would leave a desktop reader short.
         */
        <li
          key={v.entryId}
          className={`min-w-0 flex-1 border-t border-seam first:border-t-0 ${
            i >= PHONE_ROWS ? "hidden sm:flex" : "flex"
          }`}
        >
          <Link
            href={`/film/${v.slug}`}
            className="group flex min-w-0 flex-1 items-center gap-3 py-2.5 transition-colors hover:bg-[rgba(255,255,255,.02)] sm:gap-2.5 sm:py-0"
          >
            <PosterImg
              posterPath={v.posterPath}
              title={v.title}
              size="w154"
              sizes="(min-width: 640px) 24px, 36px"
              className="h-[54px] w-9 shrink-0 rounded-[3px] object-cover sm:h-9 sm:w-6"
            />

            {/* `overflow-hidden` so a shrink-0 child can never paint outside
                this cell, whatever it holds. */}
            <span className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden">
              <span className="truncate text-[15px] text-paper group-hover:text-white sm:text-[13px]">
                {v.title}
              </span>
              {v.year !== null && (
                <span className="num shrink-0 text-[12px] text-dim sm:text-[11px]">{v.year}</span>
              )}
              {v.rewatch && <Tag>Rewatch</Tag>}
              {v.hasReview && <Tag>Review</Tag>}
            </span>

            <span className="num w-14 shrink-0 text-right text-[12px] text-ash sm:w-20 sm:text-[11px]">
              {dateLabel(v.watchedOn)}
            </span>

            {/* An unrated viewing is a real state, not a gap to apologise for:
                the product lets anyone log without rating, so it prints as a
                quiet dash rather than a prompt. It keeps the column so the
                dash lands where a figure would have. */}
            {v.rating === null ? (
              <span
                className="num w-[50px] shrink-0 text-right text-[19px] leading-none sm:w-[46px] sm:text-[15px] text-dim"
                title="Watched, not rated"
              >
                &ndash;
              </span>
            ) : (
              <span
                className={`num w-[50px] shrink-0 text-right text-[19px] leading-none sm:w-[46px] sm:text-[15px] ${ratingColor(v.rating)}`}
              >
                {formatTenths(v.rating)}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * A supplementary mark, and the first thing to go when the row is narrow.
 *
 * On a phone this panel gives a title about 150px. A row carrying both tags
 * spends two thirds of that on them and leaves the title as an ellipsis, which
 * inverts what the row is for: the tags qualify a title nobody can read any
 * more. They are dropped under `sm` rather than clipped, and the diary a tap
 * away carries the same facts in full.
 */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="hidden shrink-0 rounded-full border border-seam px-1.5 text-[10px] text-dim sm:inline">
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
