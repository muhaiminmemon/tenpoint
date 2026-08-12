"use client";

import { useMemo } from "react";
import Link from "next/link";
import ProfileWatchlistList, { type ProfileWatchlistRow } from "./ProfileWatchlistList";
import { useUrlState, useUrlText } from "@/lib/useUrlState";

type SortMode = "added" | "added-old" | "title";
// Kept in the URL: opening a title from here should come back to this view.
const SORT_KEYS = ["added", "added-old", "title"] as const;

const SORT_LABELS: Record<SortMode, string> = {
  added: "Recently added",
  "added-old": "Oldest added",
  title: "Title A–Z",
};

export default function ProfileWatchlistTab({
  rows,
  editable,
}: {
  rows: ProfileWatchlistRow[];
  editable: boolean;
}) {
  const [filter, setFilter] = useUrlText("q");
  const [sort, setSort] = useUrlState<SortMode>("sort", "added", SORT_KEYS);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let out = q ? rows.filter((r) => r.title.toLowerCase().includes(q)) : rows;
    // `rows` arrives newest-added-first from the server
    if (sort === "added-old") out = [...out].reverse();
    else if (sort === "title") out = [...out].sort((a, b) => a.title.localeCompare(b.title));
    return out;
  }, [rows, filter, sort]);

  if (rows.length === 0) {
    return <p className="py-8 text-sm text-ash">Nothing on the watchlist yet.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter title"
          aria-label="Filter watchlist"
          className="w-48 rounded-card border border-seam bg-tray px-3 py-1.5 text-sm placeholder:text-ash focus:border-beam focus:outline-none"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          aria-label="Sort watchlist by"
          className="rounded-card border border-seam bg-tray px-2 py-1.5 text-sm text-paper"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {editable && (
          <Link href="/watchlist" className="ml-auto text-sm text-ash hover:text-paper">
            Edit watchlist
          </Link>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="py-8 text-sm text-ash">No films match that filter.</p>
      ) : (
        <ProfileWatchlistList rows={visible} />
      )}
    </div>
  );
}
