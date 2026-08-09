"use client";

import { useState } from "react";
import Link from "next/link";

import { formatTenths, ratingColor } from "@/lib/format";
import Avatar from "./Avatar";

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
export default function RatingChips({
  items,
  initial = 18,
}: {
  items: ChipRating[];
  initial?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const people = byPerson(items);
  const shown = expanded ? people : people.slice(0, initial);
  const hidden = people.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((person) => (
        <Link
          key={person.username}
          href={`/${person.username}`}
          className="inline-flex min-h-[26px] flex-wrap items-center gap-x-1.5 gap-y-1 rounded-full border border-seam bg-tray py-[3px] pl-[3px] pr-[9px] transition-colors hover:border-edge hover:bg-tray-2"
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
        </Link>
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
    </div>
  );
}
