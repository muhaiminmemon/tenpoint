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
};

type Person = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  scores: { id: string; rating: number; part: string | null; partSort: number | null }[];
};

/**
 * One chip per person, not per score.
 *
 * On a film that is the same thing. On a series it is not: television opinion
 * is stored per season, so somebody who followed a show through nine of them
 * owns nine rows, and a run keyed to rows was the same name eight times in a
 * scrambled season order. Their seasons belong together and in order.
 */
function byPerson(items: ChipRating[]): Person[] {
  const people = new Map<string, Person>();
  for (const item of items) {
    const person = people.get(item.username) ?? {
      username: item.username,
      displayName: item.displayName,
      avatarUrl: item.avatarUrl,
      scores: [],
    };
    person.scores.push({
      id: item.id,
      rating: item.rating,
      part: item.part,
      partSort: item.partSort,
    });
    people.set(item.username, person);
  }
  for (const person of people.values()) {
    person.scores.sort((a, b) => (a.partSort ?? 0) - (b.partSort ?? 0));
  }
  // insertion order is the feed's order, so whoever rated most recently leads
  return [...people.values()];
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
          {person.scores.map((score) => (
            <span key={score.id} className="inline-flex items-baseline gap-1">
              {shortPart(score.part, score.partSort) && (
                <span className="num text-[11px] text-ash">
                  {shortPart(score.part, score.partSort)}
                </span>
              )}
              <span className={`num text-[12px] ${ratingColor(score.rating)}`}>
                {formatTenths(score.rating)}
              </span>
            </span>
          ))}
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
