"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Sheet from "./Sheet";
import {
  BROWSE_GENRES,
  DECADES,
  EMPTY_FILTERS,
  LANGUAGES,
  MIN_RATINGS,
  RUNTIMES,
  SORTS,
  SOURCES,
  filtersToQuery,
  isFiltered,
  yearOptions,
  type BrowseFilters as Filters,
} from "@/lib/browse";

/**
 * The controls, which write to the URL rather than to state.
 *
 * Every change is a navigation, so a filtered view is a link someone can send,
 * bookmark or reach with the back button, and the grid always renders on the
 * server already filtered — there is no empty frame that fills in afterwards.
 *
 * `useTransition` is what keeps that from feeling like page loads: the current
 * results stay on screen and dim while the next set is fetched, instead of
 * blanking. Changing any filter also drops back to page one, because staying
 * on page 7 of a query you just replaced is how people end up looking at an
 * empty grid.
 *
 * Seven controls do not fit across a phone, so below `sm` everything except
 * the sort chips moves into a sheet behind one button that counts what is
 * active. The chips stay out because sorting is the control people reach for
 * most and it survives a horizontal scroll.
 */
export default function BrowseFilters({ filters }: { filters: Filters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  function apply(next: Partial<Filters>) {
    startTransition(() => {
      router.replace(`/browse${filtersToQuery({ ...filters, ...next, page: 1 })}`, {
        scroll: false,
      });
    });
  }

  const leaderboard = filters.source !== "tmdb";

  // Everything the reader has narrowed, minus the source and sort which are
  // always visible — the badge should count what the sheet is hiding.
  const activeCount = [
    filters.genre,
    filters.decade,
    filters.year,
    filters.language,
    filters.runtime,
    filters.minRating,
    filters.gems ? 1 : null,
    filters.source === "tmdb" ? null : 1,
  ].filter((v) => v !== null).length;

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Which number the grid is ordered by. It sits with the other controls
          rather than above them because it narrows nothing — every filter
          beside it keeps working whichever way this is set. */}
      <Select
        label="Rated by"
        value={filters.source}
        onChange={(v) => apply({ source: v as Filters["source"] })}
        options={SOURCES.map((s) => ({ value: s.key, label: `Rated by ${s.label}` }))}
      />
      <Select
        label="Genre"
        value={filters.genre === null ? "" : String(filters.genre)}
        onChange={(v) => apply({ genre: v ? Number(v) : null })}
        options={[
          { value: "", label: "Any genre" },
          ...BROWSE_GENRES.map((g) => ({ value: String(g.id), label: g.name })),
        ]}
      />
      <Select
        label="Decade"
        value={filters.decade === null ? "" : String(filters.decade)}
        onChange={(v) => apply({ decade: v ? Number(v) : null, year: null })}
        options={[
          { value: "", label: "Any decade" },
          ...DECADES.map((d) => ({ value: String(d), label: `${d}s` })),
        ]}
      />
      <Select
        label="Year"
        value={filters.year === null ? "" : String(filters.year)}
        onChange={(v) => apply({ year: v ? Number(v) : null, decade: null })}
        options={[
          { value: "", label: "Any year" },
          ...yearOptions().map((y) => ({ value: String(y), label: String(y) })),
        ]}
      />
      <Select
        label="Runtime"
        value={filters.runtime ?? ""}
        onChange={(v) => apply({ runtime: (v || null) as Filters["runtime"] })}
        options={[
          { value: "", label: "Any length" },
          ...RUNTIMES.map((r) => ({ value: r.key, label: r.label })),
        ]}
      />
      <Select
        label="Rating"
        value={filters.minRating === null ? "" : String(filters.minRating)}
        onChange={(v) => apply({ minRating: v ? Number(v) : null })}
        options={[
          { value: "", label: "Any rating" },
          ...MIN_RATINGS.map((m) => ({
            value: String(m),
            label: `${(m / 10).toFixed(1)} and up`,
          })),
        ]}
      />

      <Select
        label="Language"
        value={filters.language ?? ""}
        onChange={(v) => apply({ language: v || null })}
        options={[
          { value: "", label: "Any language" },
          ...LANGUAGES.map((l) => ({ value: l.code, label: l.name })),
        ]}
      />

      <Chip active={filters.gems} onClick={() => apply({ gems: !filters.gems })}>
        Hidden gems
      </Chip>
    </div>
  );

  return (
    <div
      className={`transition-opacity duration-200 ${pending ? "opacity-60" : "opacity-100"}`}
      aria-busy={pending}
    >
      {/* Sorting only applies to TMDB's index: choosing IMDb or the
          Tomatometer already names the order. */}
      {!leaderboard && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
          {SORTS.map((s) => (
            <Chip
              key={s.key}
              active={filters.sort === s.key}
              onClick={() => apply({ sort: s.key })}
              className="shrink-0"
            >
              {s.label}
            </Chip>
          ))}
        </div>
      )}

      {/* Desktop: everything laid out. Phone: one button and a sheet. */}
      <div className="mt-3 hidden sm:block">{controls}</div>

      <div className="mt-3 flex items-center gap-2 sm:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-2 rounded-full border border-seam px-3.5 py-1.5 text-[12.5px] text-ash transition-colors active:bg-tray"
        >
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M3 5.5h14M5.5 10h9M8.5 14.5h3" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="num flex size-4 items-center justify-center rounded-full bg-paper text-[10px] text-carbon">
              {activeCount}
            </span>
          )}
        </button>

        {isFiltered(filters) && (
          <button
            type="button"
            onClick={() => apply(EMPTY_FILTERS)}
            className="rounded-full px-3 py-1.5 text-[12.5px] text-ash active:text-paper"
          >
            Clear
          </button>
        )}
      </div>

      {isFiltered(filters) && (
        <button
          type="button"
          onClick={() => apply(EMPTY_FILTERS)}
          className="mt-3 hidden rounded-full px-3 py-1.5 text-[12.5px] text-ash transition-colors hover:text-paper sm:inline-block"
        >
          Clear everything
        </button>
      )}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filters">
        <div className="mt-4 [&_select]:w-full [&>div]:flex-col [&>div]:items-stretch [&>div]:gap-2.5">
          {controls}
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(false)}
          className="display mt-5 w-full rounded-card bg-paper py-3 text-[14px] font-medium text-carbon"
        >
          Show results
        </button>
      </Sheet>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors ${
        active
          ? "border-paper bg-paper text-carbon"
          : "border-seam text-ash hover:border-dim hover:text-paper"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        // 16px on touch: anything smaller makes iOS Safari zoom the page in.
        className="appearance-none rounded-full border border-seam bg-tray py-2 pl-3.5 pr-8 text-base text-paper transition-colors hover:border-dim focus:border-beam focus:outline-none sm:py-1.5 sm:text-[12.5px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-3 size-3.5 text-dim"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}
