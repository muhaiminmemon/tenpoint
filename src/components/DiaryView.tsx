"use client";

import { useMemo, useState } from "react";
import { useUrlNumber, useUrlState } from "@/lib/useUrlState";
import Link from "next/link";
import { ArrowCounterClockwise, CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import { accentFor, formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import Sheet from "./Sheet";
import AutoHeight from "./AutoHeight";

export type DiaryRow = {
  id: string;
  watchedOn: string | null;
  rating: number | null;
  rewatch: boolean;
  private: boolean;
  review: string | null;
  spoiler: boolean;
  title: string;
  year: number | null;
  slug: string;
  posterPath: string | null;
  runtime: number | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

const DIARY_VIEWS = ["calendar", "timeline"] as const;

/** Sunday-first, as in the design. */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export default function DiaryView({ rows }: { rows: DiaryRow[] }) {
  const [view, setView] = useUrlState<"calendar" | "timeline">("view", "calendar", DIARY_VIEWS);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    // searching your own words, not just titles
    return rows.filter(
      (r) => r.title.toLowerCase().includes(q) || (r.review ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const months = useMemo(() => {
    const keys = new Set<string>();
    for (const r of filtered) if (r.watchedOn) keys.add(monthKey(r.watchedOn));
    return [...keys].sort().reverse();
  }, [filtered]);

  // Bounded by the months that actually exist, so a stale link lands on the
  // nearest real month instead of an empty grid.
  const [monthIndex, setMonthIndex] = useUrlNumber("m", 0, Math.max(0, months.length - 1));
  const active = months[Math.min(monthIndex, months.length - 1)] ?? null;

  /** Open state for the month jump. Closing on a pick is what makes it feel like a step rather than a mode. */
  const [jumping, setJumping] = useState(false);

  /** How many viewings each month holds, so the jump can show where the diary actually is. */
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      if (!r.watchedOn) continue;
      const k = monthKey(r.watchedOn);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [filtered]);

  const inMonth = useMemo(
    () => (active ? filtered.filter((r) => r.watchedOn && monthKey(r.watchedOn) === active) : []),
    [filtered, active],
  );

  /** The four numbers that describe a month of watching. */
  const pace = useMemo(() => {
    const rated = inMonth.filter((r) => r.rating !== null);
    const mean = rated.length
      ? Math.round(rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length)
      : null;
    const minutes = inMonth.reduce((s, r) => s + (r.runtime ?? 0), 0);
    return {
      watched: inMonth.length,
      mean,
      rewatches: inMonth.filter((r) => r.rewatch).length,
      hours: minutes ? (minutes / 60).toFixed(1) : null,
    };
  }, [inMonth]);

  const toggle = (
    <div className="flex overflow-hidden rounded-card border border-seam text-xs" role="group" aria-label="View">
      {(["calendar", "timeline"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => setView(v)}
          className={`px-2.5 py-1.5 capitalize transition-colors ${
            view === v ? "bg-tray-2 text-paper" : "text-ash hover:text-paper"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );

  const search = (
    <input
      type="search"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search your reviews"
      aria-label="Search diary"
      className="w-full rounded-card border border-seam bg-lift px-3 py-1.5 text-xs text-paper placeholder:text-dim focus:border-beam focus:outline-none sm:w-60"
    />
  );

  return (
    <div className="overflow-hidden rounded-xl border border-seam bg-carbon">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-seam p-4">
        {view === "calendar" && active ? (
          <>
            {/* The month name is the control. Stepping one month at a time is
                fine for last month and useless for 2014, and the heading was
                already the thing people aimed at.

                Unless there is only one month, which is most diaries here: a
                picker offering the month somebody is already looking at is a
                control that does nothing, so the heading stays a heading. */}
            {months.length > 1 ? (
              <button
                type="button"
                onClick={() => setJumping((j) => !j)}
                aria-expanded={jumping}
                className="group flex items-center gap-1.5 rounded-card text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-beam-edge"
              >
                <h2 className="display text-[22px] text-paper">{monthLabel(active)}</h2>
                <CaretDown
                  aria-hidden
                  weight="bold"
                  className={`size-3.5 text-ash transition-transform duration-200 group-hover:text-paper ${jumping ? "rotate-180" : ""}`}
                />
              </button>
            ) : (
              <h2 className="display text-[22px] text-paper">{monthLabel(active)}</h2>
            )}
            <div className={`flex gap-1 ${months.length > 1 ? "" : "hidden"}`}>
              <StepButton
                dir="prev"
                label="Older month"
                disabled={monthIndex >= months.length - 1}
                onClick={() => {
                  setJumping(false);
                  setMonthIndex(Math.min(months.length - 1, monthIndex + 1));
                }}
              />
              <StepButton
                dir="next"
                label="Newer month"
                disabled={monthIndex <= 0}
                onClick={() => {
                  setJumping(false);
                  setMonthIndex(Math.max(0, monthIndex - 1));
                }}
              />
            </div>
          </>
        ) : (
          <h2 className="display text-[22px] text-paper">
            {query ? `${filtered.length} ${filtered.length === 1 ? "match" : "matches"}` : "Everything"}
          </h2>
        )}
        {toggle}
        <div className="ml-auto w-full sm:w-auto">{search}</div>
      </div>

      {/* Eased rather than toggled. Switching to the timeline removes sixty
          pixels of stats, and dropping them on the same frame made the card
          lurch before the grid below it had started moving. */}
      <AutoHeight>
        {view === "calendar" && active ? (
          <div className="grid grid-cols-2 border-b border-seam sm:grid-cols-4">
            <PaceStat label="Watched" value={String(pace.watched)} unit="films" />
            <PaceStat
              label="Avg rating"
              value={pace.mean !== null ? formatTenths(pace.mean) : "0.0"}
            />
            <PaceStat label="Rewatches" value={String(pace.rewatches)} />
            <PaceStat label="Hours" value={pace.hours ?? "0"} last />
          </div>
        ) : null}
      </AutoHeight>

      {/* A month is a fixed-size thing, and months differ by a whole row, so
          the grid is worth easing between: paging back through the year should
          feel like turning pages rather than the card snapping taller and
          shorter. The key makes each month replay its own rules drawing in. */}
      <AutoHeight innerClassName="p-4">
        {filtered.length === 0 ? (
          <p className="py-8 text-sm text-ash">
            {query ? "Nothing matches that." : "Nothing logged yet."}
          </p>
        ) : view === "calendar" ? (
          jumping && active ? (
            <MonthJump
              months={months}
              counts={counts}
              active={active}
              onPick={(key) => {
                setMonthIndex(months.indexOf(key));
                setJumping(false);
              }}
            />
          ) : active ? (
            <CalendarGrid key={active} monthKey={active} rows={inMonth} />
          ) : (
            <p className="py-8 text-sm text-ash">No dated viewings to show.</p>
          )
        ) : (
          <Timeline rows={filtered} />
        )}
      </AutoHeight>
    </div>
  );
}

/**
 * Reaching any month in two taps, at a height that never changes.
 *
 * The first attempt at this printed every year as a heading and every month as
 * a full-width tile underneath, which produced a panel taller than the screen,
 * pushed the calendar out of view, and left the years as labels somebody could
 * read but not press. The fix is not smaller tiles. It is that a year is a
 * control: pick the year, then pick the month, and the panel is the same two
 * rows whether the diary covers one year or fifteen.
 *
 * Only months that hold something can be pressed. A generic date picker would
 * happily send somebody to March 2019 and show them an empty grid, which is a
 * worse answer than not letting them ask. Empty months keep their slot anyway,
 * because reading Jan through Dec in place is the whole affordance, and a grid
 * that closes the gaps stops being a year.
 */
function MonthJump({
  months,
  counts,
  active,
  onPick,
}: {
  months: string[];
  counts: Map<string, number>;
  active: string;
  onPick: (key: string) => void;
}) {
  // Newest first, matching the direction the month arrows already walk.
  const years = useMemo(
    () => [...new Set(months.map((k) => k.slice(0, 4)))].sort().reverse(),
    [months],
  );
  const [year, setYear] = useState(active.slice(0, 4));
  // A diary that gains a year while the panel is open should not strand the
  // selection on a year that is no longer in the filtered set.
  const shownYear = years.includes(year) ? year : (years[0] ?? active.slice(0, 4));

  return (
    // Capped, because this is a control rather than a layout: left to fill a
    // wide card, a slot holding three letters stretches past two hundred
    // pixels and the panel reads as a table of contents. Centred, because a
    // capped block pinned to the left of a card this wide leaves the right
    // half looking like something failed to load.
    <div className="fade-up mx-auto max-w-[34rem]">
      {years.length > 1 && (
        // Wrapped, not scrolled. A row of years that runs off the edge hides
        // the oldest ones behind an overlay scrollbar macOS does not draw
        // until you touch it, and opening on a month from 2017 would scroll
        // the selected year out of sight entirely. Ten years is two rows here
        // and nothing is hidden.
        <div role="group" aria-label="Year" className="flex flex-wrap gap-1 pb-3">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              aria-pressed={y === shownYear}
              onClick={() => setYear(y)}
              className={`num flex min-h-9 shrink-0 items-center rounded-card px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-beam-edge ${
                y === shownYear ? "bg-tray-2 text-paper" : "text-ash hover:text-paper"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-6 gap-1">
        {MONTHS_SHORT.map((label, i) => {
          const key = `${shownYear}-${String(i + 1).padStart(2, "0")}`;
          const count = counts.get(key) ?? 0;
          const isActive = key === active;
          if (count === 0) {
            // Present, so the year still reads left to right, and outlined
            // faintly enough that twelve slots read as a year rather than as
            // four boxes with holes between them. Nothing to press, nothing to
            // focus, and no number to imply there is something there.
            return (
              <span
                key={key}
                aria-hidden
                className="flex h-12 items-center justify-center rounded-card border border-seam/40 text-[12px] text-dim/50"
              >
                {label}
              </span>
            );
          }
          return (
            <button
              key={key}
              type="button"
              aria-current={isActive ? "true" : undefined}
              aria-label={`${MONTHS[i]} ${shownYear}, ${count} ${count === 1 ? "viewing" : "viewings"}`}
              onClick={() => onPick(key)}
              className={`flex h-12 flex-col items-center justify-center gap-px rounded-card border text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-beam-edge ${
                isActive
                  ? "border-transparent bg-paper font-medium text-carbon"
                  : "border-seam text-paper hover:border-dim hover:bg-tray"
              }`}
            >
              {label}
              <span className={`num text-[10px] ${isActive ? "text-carbon/55" : "text-ash"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepButton({
  dir,
  label,
  onClick,
  disabled,
}: {
  dir: "prev" | "next";
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = dir === "prev" ? CaretLeft : CaretRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-card border border-seam text-ash transition-colors hover:border-dim hover:text-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-beam-edge disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon aria-hidden weight="bold" className="size-3" />
    </button>
  );
}

function PaceStat({
  label,
  value,
  unit,
  last,
}: {
  label: string;
  value: string;
  unit?: string;
  last?: boolean;
}) {
  return (
    <div className={`px-4 py-3.5 ${last ? "" : "border-r border-seam"}`}>
      <div className="num text-2xl text-paper">
        {value}
        {unit && <span className="ml-1 text-xs text-ash">{unit}</span>}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-ash">{label}</div>
    </div>
  );
}

function CalendarGrid({ monthKey: key, rows }: { monthKey: string; rows: DiaryRow[] }) {
  const [openDay, setOpenDay] = useState<number | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<number, DiaryRow[]>();
    for (const r of rows) {
      if (!r.watchedOn) continue;
      const d = Number(r.watchedOn.slice(8, 10));
      const list = map.get(d) ?? [];
      list.push(r);
      map.set(d, list);
    }
    return map;
  }, [rows]);

  const [year, month] = key.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // Sunday-first
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const openFilms = openDay !== null ? (byDay.get(openDay) ?? []) : [];

  return (
    <div className="fade-up">
      <div className="mb-2 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] uppercase tracking-[0.1em] text-dim">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />;
          const films = byDay.get(day) ?? [];
          if (films.length === 0) {
            return (
              <div
                key={day}
                className="relative aspect-[1/1.05] rounded-card border border-tray p-1 sm:p-1.5"
              >
                <span className="num text-[9px] text-dim sm:text-[11px]">{day}</span>
              </div>
            );
          }
          return (
            <button
              key={day}
              type="button"
              onClick={() => setOpenDay(day)}
              aria-label={dayLabel(MONTHS[month - 1], day, films)}
              title={films.map((f) => f.title).join(", ")}
              className="block rounded-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-beam focus-visible:ring-offset-2 focus-visible:ring-offset-carbon"
            >
              <DayCell day={day} films={films} />
            </button>
          );
        })}
      </div>

      <Sheet
        open={openDay !== null}
        onClose={() => setOpenDay(null)}
        title={openDay !== null ? `${MONTHS[month - 1]} ${openDay}, ${year}` : ""}
      >
        <ul className="mt-4 flex flex-col gap-1">
          {openFilms.map((f) => {
            const poster = posterUrl(f.posterPath, "w154");
            return (
              <li key={f.id}>
                <Link
                  href={`/film/${f.slug}`}
                  onClick={() => setOpenDay(null)}
                  className="flex items-center gap-3 rounded-card p-2 hover:bg-tray"
                >
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={poster}
                      alt=""
                      loading="lazy"
                      className="h-[54px] w-9 shrink-0 rounded-[3px] bg-tray object-cover"
                    />
                  ) : (
                    <span className="h-[54px] w-9 shrink-0 rounded-[3px] bg-tray" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate text-sm text-paper">{f.title}</span>
                      {f.rewatch && (
                        <span className="flex items-center gap-1 text-[10px] text-beam">
                          <ArrowCounterClockwise aria-hidden className="size-2.5" />
                          rewatch
                        </span>
                      )}
                    </span>
                    <span className="num block text-[11px] text-ash">{f.year ?? ""}</span>
                  </span>
                  {f.rating !== null && (
                    <span className={`num text-sm ${ratingColor(f.rating)}`}>
                      {formatTenths(f.rating)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}

/**
 * How many posters a day cell shows before it starts counting instead.
 *
 * Three, because the cell is one seventh of the grid: on a narrow phone that
 * is roughly 40px, so a fourth slice would be too thin to read as a film. Days
 * with more say so with a count rather than shrinking further.
 */
const POSTERS_PER_DAY = 3;

/**
 * The day's rating: the mean of whatever was rated that day, in tenths.
 *
 * One film is just that film's rating, so the cell has a single rule rather
 * than one number for solo days and a different one for busy days. Unrated
 * viewings are left out of the mean instead of counting as zero, and a day
 * with nothing rated returns null rather than 0.0 — the product lets anyone
 * log without rating, and a day of unrated viewings has no rating, which is
 * not the same as a bad one.
 *
 * Tenths stay integers throughout: they are summed as integers and rounded
 * back to an integer tenth before anything formats them, the same way the
 * month's average above is taken.
 */
/**
 * What a day cell reads as to a screen reader. The cell shows one number
 * whether it covers one film or five, so this is where the difference is
 * said out loud rather than left to be inferred from the artwork.
 */
function dayLabel(month: string, day: number, films: DiaryRow[]): string {
  const titles = films.map((f) => f.title).join(", ");
  const rating = dayAverage(films);
  if (rating === null) return `${month} ${day}: ${titles}. Not rated.`;
  return films.length === 1
    ? `${month} ${day}: ${titles}, rated ${formatTenths(rating)}.`
    : `${month} ${day}: ${titles}. ${films.length} films, averaging ${formatTenths(rating)}.`;
}

function dayAverage(films: DiaryRow[]): number | null {
  const rated = films.filter((f) => f.rating !== null);
  if (!rated.length) return null;
  return Math.round(rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length);
}

/**
 * A day of watching, drawn as the films themselves.
 *
 * The posters are the cell, sliced side by side and cropped — at this size a
 * whole poster is unreadable anyway, so what survives is its colour and
 * contrast, and a month of cells reads as a strip of what was actually
 * watched. A film with no poster on file falls back to its own accent colour
 * so the strip never gains a hole.
 *
 * Everything written on top sits over a scrim rather than beside the artwork,
 * which is what keeps the day number and rating legible across posters this
 * component cannot predict.
 */
function DayCell({ day, films }: { day: number; films: DiaryRow[] }) {
  const shown = films.slice(0, POSTERS_PER_DAY);
  const extra = films.length - shown.length;
  const rating = dayAverage(films);

  return (
    <div className="relative aspect-[1/1.05] overflow-hidden rounded-card border border-seam bg-lift">
      <span aria-hidden className="absolute inset-0 flex">
        {shown.map((f, i) => {
          const poster = posterUrl(f.posterPath, "w154");
          // A hairline between films, so two posters of similar colour still
          // read as two films rather than one wide image. Dark rather than
          // light because it has to hold against artwork of any brightness.
          const divide = i === 0 ? "" : "border-l border-[rgba(8,8,10,.7)]";
          return poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={f.id}
              src={poster}
              alt=""
              loading="lazy"
              decoding="async"
              className={`h-full min-w-0 flex-1 object-cover ${divide}`}
            />
          ) : (
            <span
              key={f.id}
              className={`h-full min-w-0 flex-1 ${divide}`}
              style={{ background: accentFor(f.slug) }}
            />
          );
        })}
      </span>

      {/* Dark at top and bottom where the type sits, clearer through the
          middle so the artwork still comes through. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,10,.78)_0%,rgba(8,8,10,.24)_42%,rgba(8,8,10,.86)_100%)]"
      />

      <span className="num absolute left-1 top-0.5 text-[9px] text-paper sm:left-1.5 sm:top-1 sm:text-[11px]">
        {day}
      </span>

      {films.some((f) => f.rewatch) && (
        <span
          aria-hidden
          className="absolute right-1 top-0.5 text-beam sm:right-1.5 sm:top-1"
        >
          <ArrowCounterClockwise className="size-2 sm:size-2.5" />
        </span>
      )}

      {rating !== null && (
        <span
          className={`num absolute bottom-0.5 left-1 text-[10px] sm:bottom-1 sm:left-1.5 sm:text-[13px] ${ratingColor(rating)}`}
        >
          {formatTenths(rating)}
        </span>
      )}

      {extra > 0 && (
        <span className="num absolute bottom-0.5 right-1 text-[9px] text-ash sm:bottom-1 sm:right-1.5">
          +{extra}
        </span>
      )}
    </div>
  );
}

function Timeline({ rows }: { rows: DiaryRow[] }) {
  const groups = useMemo(() => {
    const out: { label: string; rows: DiaryRow[] }[] = [];
    for (const r of rows) {
      const label = r.watchedOn ? monthLabel(monthKey(r.watchedOn)) : "No date";
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(r);
      else out.push({ label, rows: [r] });
    }
    return out;
  }, [rows]);

  return (
    <div className="fade-up">
      {groups.map((g) => (
        <section key={g.label} className="mb-7 last:mb-0">
          <h3 className="mb-3 text-[11px] uppercase tracking-[0.14em] text-ash">{g.label}</h3>
          <ul className="flex flex-col gap-3.5">
            {g.rows.map((r) => {
              const poster = posterUrl(r.posterPath, "w154");
              const day = r.watchedOn
                ? new Date(r.watchedOn + "T00:00:00").toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })
                : "No date";
              return (
                <li key={r.id} className="flex gap-3">
                  {/* the connector makes a run of viewings read as one thread */}
                  <div className="flex w-9 shrink-0 flex-col items-center">
                    <span className="num text-center text-[10px] leading-tight text-ash">
                      {day}
                    </span>
                    <span aria-hidden className="mt-1.5 w-px flex-1 bg-seam" />
                  </div>
                  <Link href={`/film/${r.slug}`} className="shrink-0">
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={poster}
                        alt=""
                        loading="lazy"
                        className="w-12 rounded-[5px] bg-tray object-cover"
                        style={{ aspectRatio: "2/3" }}
                      />
                    ) : (
                      <span className="block w-12 rounded-[5px] bg-tray" style={{ aspectRatio: "2/3" }} />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1 pb-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={`/film/${r.slug}`}
                        className="display truncate text-[13px] text-paper hover:underline"
                      >
                        {r.title}
                      </Link>
                      {r.rewatch && (
                        <span className="flex items-center gap-1 text-[10px] text-beam">
                          <ArrowCounterClockwise aria-hidden className="size-2.5" />
                          rewatch
                        </span>
                      )}
                      {r.private && <span className="text-[10px] text-dim">only me</span>}
                    </div>
                    {r.rating !== null && (
                      <div className={`num my-px text-[15px] ${ratingColor(r.rating)}`}>
                        {formatTenths(r.rating)}
                      </div>
                    )}
                    {r.review && (
                      <p className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-ash">
                        {r.spoiler ? "Mentions plot details." : r.review}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
