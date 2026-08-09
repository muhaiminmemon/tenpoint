"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, Faders, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import Sheet from "./Sheet";
import {
  BROWSE_GENRES,
  SHOW_GENRES,
  MEDIA,
  DECADES,
  EMPTY_FILTERS,
  LANGUAGES,
  MAX_QUERY,
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

  // The box is typed into, so it holds its own text; the URL is the truth it
  // syncs back from when a search arrives from anywhere else (a link, the back
  // button, the clear button).
  const [text, setText] = useState(filters.q);
  const lastQ = useRef(filters.q);
  useEffect(() => {
    if (lastQ.current !== filters.q) {
      lastQ.current = filters.q;
      setText(filters.q);
    }
  }, [filters.q]);

  function apply(next: Partial<Filters>) {
    startTransition(() => {
      router.replace(`/browse${filtersToQuery({ ...filters, ...next, page: 1 })}`, {
        scroll: false,
      });
    });
  }

  /**
   * Submitted rather than typed into.
   *
   * Every keystroke here would be a navigation and two TMDB calls, on our key,
   * for a query nobody has finished writing. Enter, or the button, is also
   * what a search field is expected to do.
   */
  function search(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim().slice(0, MAX_QUERY);
    if (q === filters.q) return;
    // A new search should not inherit the last one's guess about what it meant.
    apply({ q, as: null });
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
          ...(filters.media === "show" ? SHOW_GENRES : BROWSE_GENRES).map((g) => ({
            value: String(g.id),
            label: g.name,
          })),
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

    </div>
  );

  return (
    <div
      className={`transition-opacity duration-200 ${pending ? "opacity-60" : "opacity-100"}`}
      aria-busy={pending}
    >
      {/* Which index is being read, not a filter over one list. Films and
          series are separate at TMDB with separate genre taxonomies, so this
          sits apart from the controls and clears the genre when it changes:
          the same id means a different genre on the other side. */}
      <div
        role="group"
        aria-label="Media"
        className="mb-3 flex w-fit overflow-hidden rounded-full border border-seam"
      >
        {MEDIA.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={filters.media === m.key}
            onClick={() => apply({ media: m.key, genre: null, q: "", as: null })}
            className={`px-4 py-1.5 text-[13px] transition-colors sm:text-[12px] ${
              filters.media === m.key
                ? "bg-paper text-carbon"
                : "text-ash hover:text-paper"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={search} className="mb-3 flex items-center gap-2" role="search">
        <label className="relative flex min-w-0 flex-1 items-center sm:max-w-[320px]">
          <span className="sr-only">Search by title, director or cast</span>
          <MagnifyingGlass
            aria-hidden
            className="pointer-events-none absolute left-3 size-4 text-dim"
          />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_QUERY}
            placeholder={filters.media === "show" ? "Search shows" : "Title, director or cast"}
            aria-label="Search by title, director or cast"
            // 16px on touch, like the selects, or iOS zooms the page in.
            className={`${CONTROL_H} w-full rounded-full border border-seam bg-tray pl-9 pr-3 text-base text-paper placeholder:text-dim transition-colors hover:border-dim focus:border-beam focus:outline-none sm:text-[12px]`}
          />
        </label>
        <button
          type="submit"
          className={`${CONTROL_H} shrink-0 rounded-full border border-seam px-4 text-[13px] text-ash transition-colors hover:border-dim hover:text-paper sm:text-[12px]`}
        >
          Search
        </button>
        {filters.q && (
          <button
            type="button"
            onClick={() => {
              setText("");
              apply({ q: "", as: null });
            }}
            className="shrink-0 px-1 text-[13px] text-ash transition-colors hover:text-paper"
          >
            Clear
          </button>
        )}
      </form>

      {/* Sorting only applies to TMDB's index: choosing IMDb or the
          Tomatometer already names the order. */}
      {!leaderboard && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
          {SORTS.filter((s) => !(s.filmsOnly && filters.media === "show")).map((s) => (
            <Chip
              key={s.key}
              active={filters.sort === s.key}
              onClick={() => apply({ sort: s.key })}
              compact
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
          className="flex items-center gap-2 rounded-full border border-seam px-3.5 py-1.5 text-[13px] text-ash transition-colors active:bg-tray"
        >
          <Faders aria-hidden className="size-3.5" />
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
            className="rounded-full px-3 py-1.5 text-[13px] text-ash active:text-paper"
          >
            Clear
          </button>
        )}
      </div>

      {isFiltered(filters) && (
        <button
          type="button"
          onClick={() => apply(EMPTY_FILTERS)}
          className="mt-3 hidden rounded-full px-3 py-1.5 text-[13px] text-ash transition-colors hover:text-paper sm:inline-block"
        >
          Clear everything
        </button>
      )}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filters">
        {/* The same controls, stacked. They already run full width on touch,
            so this only has to change the axis. */}
        <div className="mt-4 [&>div]:flex-col [&>div]:items-stretch [&>div]:gap-2.5">
          {controls}
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(false)}
          className="display mt-5 w-full rounded-card bg-paper py-3 text-[15px] font-medium text-carbon"
        >
          Show results
        </button>
      </Sheet>
    </div>
  );
}

/**
 * Every control in the filter row shares this height.
 *
 * The selects have to run at 16px on touch or iOS zooms the page when one is
 * focused, which made them noticeably taller than a chip set at 12px. Sitting
 * side by side, the chip read as a mistake. A shared minimum height lines them
 * up without forcing the chip to carry type it does not need.
 */
const CONTROL_H = "min-h-[40px] sm:min-h-[32px]";

function Chip({
  active,
  onClick,
  children,
  className = "",
  compact = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  /** the sort row, which stands alone and can afford to be smaller */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border text-[13px] transition-colors sm:text-[12px] ${
        compact ? "min-h-[34px] px-4 sm:min-h-[30px] sm:px-3.5" : `${CONTROL_H} px-4 sm:px-3.5`
      } ${
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
    <label className="relative inline-flex w-full items-center sm:w-auto">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        // 16px on touch: anything smaller makes iOS Safari zoom the page in.
        className={`${CONTROL_H} w-full appearance-none rounded-full border border-seam bg-tray pl-3.5 pr-8 text-base text-paper transition-colors hover:border-dim focus:border-beam focus:outline-none sm:w-auto sm:text-[12px]`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <CaretDown aria-hidden className="pointer-events-none absolute right-3 size-3.5 text-dim" />
    </label>
  );
}
