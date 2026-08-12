"use client";

import { useState } from "react";
import Link from "next/link";

import { formatTenths, ratingColor } from "@/lib/format";
import Avatar from "./Avatar";
import Sheet from "./Sheet";

/** The date they say they watched it, in the diary's own words. */
function watchedLabel(watchedOn: string | null): string | null {
  if (!watchedOn) return null;
  const [y, m, d] = watchedOn.split("-").map(Number);
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

/**
 * "season 4" → "Season 4", "the whole series" → "Whole series".
 *
 * The article belongs to the sentence these were written for ("their rating of
 * *the whole series*"), not to a row label standing on its own.
 */
function longPart(part: string | null): string | null {
  if (!part) return null;
  const bare = part.replace(/^the /, "");
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

export type ChipRating = {
  id: string;
  rating: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** which part of the series this score is about; null on a film page */
  part: string | null;
  /** that part as a sort key: the season number, 0 for specials, -1 for the whole series */
  partSort: number | null;
  /** the date they say they watched it, for putting a rewatch in order */
  watchedOn: string | null;
};

/** One title watched one or more times, and what they made of it each time. */
type Run = {
  key: string;
  part: string | null;
  partSort: number | null;
  ratings: { rating: number; watchedOn: string | null }[];
};

type PersonBase = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  runs: Run[];
};

type Person = PersonBase & {
  /** the ends of a long run list, or all of it when it is short enough to print */
  runsShown: Run[];
  runsCollapsed: boolean;
  /** whether every run is a numbered season, so the count can say so */
  allSeasons: boolean;
};

/**
 * One chip per person; inside it, one run per thing they watched.
 *
 * On a film with a single viewing that is one number and this all collapses.
 * It stops collapsing in two places. Television opinion is stored per season,
 * so somebody who followed a show through nine of them owns nine rows, and a
 * run keyed to rows was the same name eight times in a scrambled season order.
 * And a rewatch is a second row on the same title, which put two bare numbers
 * side by side in one chip — 9.7 beside 10.0 beside 10.0, newest first, saying
 * nothing about which came when. Grouping by what was watched and ordering by
 * when turns that into the thing it actually is: a record of an opinion
 * moving, which is the whole argument for keeping rewatches separate.
 */
function byPerson(items: ChipRating[]): Person[] {
  const people = new Map<string, PersonBase>();
  for (const item of items) {
    const person = people.get(item.username) ?? {
      username: item.username,
      displayName: item.displayName,
      avatarUrl: item.avatarUrl,
      runs: [],
    };
    // the part is the title within a series; on a film there is only one
    const key = item.part ?? "";
    const run = person.runs.find((r) => r.key === key);
    const score = { rating: item.rating, watchedOn: item.watchedOn };
    if (run) {
      // The feed arrives newest first, so unshifting leaves the run in viewing
      // order before the sort below ever has to break a tie.
      run.ratings.unshift(score);
    } else {
      person.runs.push({ key, part: item.part, partSort: item.partSort, ratings: [score] });
    }
    people.set(item.username, person);
  }
  for (const person of people.values()) {
    person.runs.sort((a, b) => (a.partSort ?? 0) - (b.partSort ?? 0));
    for (const run of person.runs) {
      /**
       * When they say they watched it beats when the row was written.
       *
       * An import arrives in one burst, so `created_at` orders a decade of
       * viewings by whatever order the CSV happened to be in. Rows without a
       * date keep their position, which the feed already put in logging order.
       */
      run.ratings.sort((a, b) =>
        a.watchedOn && b.watchedOn ? a.watchedOn.localeCompare(b.watchedOn) : 0,
      );
    }
  }
  // insertion order is the feed's order, so whoever rated most recently leads
  return [...people.values()].map((person) => {
    /**
     * The same collapse, on the other axis.
     *
     * A rewatch is many scores of one title; a long series is one score of
     * many titles, and both land in the same chip. Twenty rated seasons of
     * The Simpsons measured 752px inside a 752px run — and the show has
     * thirty-eight, so the worst case is nearly double what already
     * overflowed. Ends and a count, the same as a rewatch.
     */
    const runsCollapsed = person.runs.length > 3;
    return {
      ...person,
      runsCollapsed,
      runsShown: runsCollapsed
        ? [person.runs[0], person.runs[person.runs.length - 1]]
        : person.runs,
      allSeasons: person.runs.every((r) => (r.partSort ?? -1) > 0),
    };
  });
}

/**
 * What they rated, named at the grain the page is about.
 *
 * Counting runs alone would call "seasons one and two, plus the whole series"
 * three seasons. Rating a series whole is a different act from rating its
 * parts — PRODUCT.md keeps them apart everywhere else for the same reason — so
 * the summary names them separately rather than adding them up.
 */
function ratedSummary(runs: Run[]): string {
  const seasons = runs.filter((r) => (r.partSort ?? -1) > 0).length;
  const specials = runs.some((r) => r.partSort === 0);
  const whole = runs.some((r) => r.partSort !== null && r.partSort < 0);
  const viewings = runs.reduce((n, r) => n + r.ratings.length, 0);
  const again = viewings > runs.length ? `, across ${viewings} viewings` : "";

  const named: string[] = [];
  if (seasons) named.push(`${seasons} ${seasons === 1 ? "season" : "seasons"}`);
  if (specials) named.push("the specials");
  if (whole) named.push("the whole series");

  // A film has no parts to name, so the only thing to count is the viewings.
  if (!named.length) return viewings > 1 ? `Rated ${viewings} times.` : "Rated once.";

  const list =
    named.length === 1
      ? named[0]
      : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
  return `Rated ${list}${again}.`;
}

/**
 * "season 4" is prose, and eight of them inside one chip is a paragraph. The
 * numbered seasons compress to a tick; the two that appear at most once each
 * keep their word.
 */
function shortPart(part: string | null, sort: number | null): string | null {
  if (part === null) return null;
  if (sort === null || sort < 0) return "series";
  if (sort === 0) return "specials";
  return `s${sort}`;
}

/**
 * The scores that came without a review, as one run of chips.
 *
 * Everyone who rated is here; only the last few are folded away, because a
 * hundred chips is the same wall of page the rows were. The whole set is
 * already on the client, so opening it is a state change, not a request.
 */
/**
 * The pure grouping and naming, for tests.
 *
 * Whole-series ratings are the case with no coverage in seeded data — every
 * demo account rates season by season — so the one path a reader is least
 * likely to see by accident is the one worth pinning down here.
 */
export const __testables = { byPerson, ratedSummary, longPart, shortPart };

export default function RatingChips({
  items,
  title,
  initial = 18,
}: {
  items: ChipRating[];
  /** the thing being rated, named in the sheet so the scores have a subject */
  title?: string;
  initial?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  /**
   * Which person's scores are open.
   *
   * The chip used to be a link to their profile, which answered a question
   * nobody asked here: the reason to click "s1 9.0 … 20 seasons" is to see the
   * eighteen it folded away, not to go and read someone's library. Every run is
   * already on the client, so opening them is a state change rather than a
   * request, and the profile is still one click further in.
   */
  const [openFor, setOpenFor] = useState<string | null>(null);
  const people = byPerson(items);
  const shown = expanded ? people : people.slice(0, initial);
  const hidden = people.length - shown.length;
  const active = people.find((p) => p.username === openFor) ?? null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((person) => (
        <button
          key={person.username}
          type="button"
          onClick={() => setOpenFor(person.username)}
          aria-haspopup="dialog"
          className="inline-flex min-h-[26px] flex-wrap items-center gap-x-1.5 gap-y-1 rounded-full border border-seam bg-tray py-[3px] pl-[3px] pr-[9px] text-left transition-colors hover:border-edge hover:bg-tray-2"
        >
          <Avatar
            avatarUrl={person.avatarUrl}
            name={person.displayName ?? person.username}
            size={18}
          />
          <span className="max-w-24 truncate text-[11px] text-paper">
            {person.displayName ?? person.username}
          </span>
          {person.runsShown.map((run, runIndex) => {
            /**
             * A long history collapses to its ends.
             *
             * Somebody who has watched a favourite twenty times produced a
             * 724px chip inside a 720px run: it wrapped to two lines and took
             * the whole first row to itself. Where they started and where they
             * landed is the part worth printing anyway; the count carries how
             * many viewings it took to get between them.
             */
            const collapsed = run.ratings.length > 3;
            const shown = collapsed
              ? [run.ratings[0], run.ratings[run.ratings.length - 1]]
              : run.ratings;
            return (
              <span key={run.key} className="inline-flex items-baseline gap-1">
                {runIndex > 0 && person.runsCollapsed && (
                  <span aria-hidden className="text-[10px] text-dim">
                    …
                  </span>
                )}
                {shortPart(run.part, run.partSort) && (
                  <span className="num text-[11px] text-ash">
                    {shortPart(run.part, run.partSort)}
                  </span>
                )}
                {shown.map((score, i) => (
                  <span key={i} className="inline-flex items-baseline gap-1">
                    {i > 0 && (
                      <span aria-hidden className="text-[10px] text-dim">
                        {collapsed ? "…" : "·"}
                      </span>
                    )}
                    <span className={`num text-[12px] ${ratingColor(score.rating)}`}>
                      {formatTenths(score.rating)}
                    </span>
                  </span>
                ))}
                {collapsed && (
                  <span aria-hidden className="num text-[10px] text-ash">
                    {run.ratings.length}&times;
                  </span>
                )}
                {run.ratings.length > 1 && (
                  <span className="sr-only">
                    {` — ${run.ratings.length} viewings, oldest first`}
                  </span>
                )}
              </span>
            );
          })}
          {person.runsCollapsed && (
            <span className="num text-[10px] text-ash">
              {person.runs.length} {person.allSeasons ? "seasons" : "rated"}
            </span>
          )}
        </button>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex min-h-[26px] items-center gap-1 rounded-full border border-seam px-3 text-[11px] text-ash transition-colors hover:border-edge hover:text-paper"
        >
          <span className="num">{hidden}</span> more
        </button>
      )}
      {expanded && people.length > initial && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="inline-flex min-h-[26px] items-center rounded-full border border-seam px-3 text-[11px] text-ash transition-colors hover:border-edge hover:text-paper"
        >
          Show fewer
        </button>
      )}

      {active && (
        <Sheet
          open={openFor !== null}
          onClose={() => setOpenFor(null)}
          title={active.displayName ?? active.username}
          subtitle={
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar
                  avatarUrl={active.avatarUrl}
                  name={active.displayName ?? active.username}
                  size={32}
                />
                <div className="min-w-0">
                  <div className="num truncate text-[12px] text-ash">@{active.username}</div>
                  {title && <div className="truncate text-[13px] text-paper">{title}</div>}
                </div>
              </div>
              <Link
                href={`/${active.username}`}
                className="shrink-0 text-[12px] text-beam underline underline-offset-4 hover:text-paper"
              >
                Profile
              </Link>
            </div>
          }
        >
          {/* Every run, in full. The chip prints the ends of a long list because
              it has one line to do it in; the point of opening this is to see
              the middle. */}
          <ul className="mt-4">
            {active.runs.map((run) => (
              <li
                key={run.key}
                className="flex items-baseline justify-between gap-4 border-b border-seam py-2.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-paper">
                  {longPart(run.part) ?? "Rated"}
                </span>
                <span className="flex flex-wrap items-baseline justify-end gap-x-2.5 gap-y-1">
                  {run.ratings.map((score, i) => (
                    <span key={i} className="inline-flex items-baseline gap-1.5">
                      {/* A rewatch is the same title rated again, so the date is
                          what tells the two numbers apart. */}
                      {run.ratings.length > 1 && watchedLabel(score.watchedOn) && (
                        <span className="text-[11px] text-dim">
                          {watchedLabel(score.watchedOn)}
                        </span>
                      )}
                      <span className={`num text-[15px] ${ratingColor(score.rating)}`}>
                        {formatTenths(score.rating)}
                      </span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[12px] leading-relaxed text-ash">{ratedSummary(active.runs)}</p>
        </Sheet>
      )}
    </div>
  );
}
