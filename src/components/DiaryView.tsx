"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import Sheet from "./Sheet";

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

/** Sunday-first, as in the design. */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Each film gets its own quiet accent, stable across renders, so a month reads
 * as a set of distinct things rather than one repeated colour.
 */
const ACCENTS = ["#8faecc", "#d9b25f", "#8fbf7f", "#c4756a", "#a99ad9", "#6fb0a8"];

function accentFor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export default function DiaryView({ rows }: { rows: DiaryRow[] }) {
  const [view, setView] = useState<"calendar" | "timeline">("calendar");
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

  const [monthIndex, setMonthIndex] = useState(0);
  const active = months[Math.min(monthIndex, months.length - 1)] ?? null;

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
            <h2 className="display text-[22px] text-paper">{monthLabel(active)}</h2>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMonthIndex((i) => Math.min(months.length - 1, i + 1))}
                disabled={monthIndex >= months.length - 1}
                aria-label="Older month"
                className="rounded-card border border-seam px-2 py-1 text-xs text-ash hover:text-paper disabled:opacity-40"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setMonthIndex((i) => Math.max(0, i - 1))}
                disabled={monthIndex <= 0}
                aria-label="Newer month"
                className="rounded-card border border-seam px-2 py-1 text-xs text-ash hover:text-paper disabled:opacity-40"
              >
                →
              </button>
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

      {view === "calendar" && active && (
        <div className="grid grid-cols-2 border-b border-seam sm:grid-cols-4">
          <PaceStat label="Watched" value={String(pace.watched)} unit="films" />
          <PaceStat
            label="Avg rating"
            value={pace.mean !== null ? formatTenths(pace.mean) : "0.0"}
          />
          <PaceStat label="Rewatches" value={String(pace.rewatches)} />
          <PaceStat label="Hours" value={pace.hours ?? "0"} last />
        </div>
      )}

      <div className="p-4">
        {filtered.length === 0 ? (
          <p className="py-8 text-sm text-ash">
            {query ? "Nothing matches that." : "Nothing logged yet."}
          </p>
        ) : view === "calendar" ? (
          active ? (
            <CalendarGrid monthKey={active} rows={inMonth} />
          ) : (
            <p className="py-8 text-sm text-ash">No dated viewings to show.</p>
          )
        ) : (
          <Timeline rows={filtered} />
        )}
      </div>
    </div>
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
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />;
          const films = byDay.get(day) ?? [];
          const first = films[0];
          const cell = (
            <div
              className={`relative aspect-[1/1.05] overflow-hidden rounded-card border p-1.5 ${
                first ? "border-seam bg-lift" : "border-tray bg-transparent"
              }`}
            >
              <span className={`num text-[9px] sm:text-[11px] ${first ? "text-paper" : "text-dim"}`}>
                {day}
              </span>
              {first && (
                <div className="absolute inset-x-1.5 bottom-1.5">
                  <div
                    aria-hidden
                    className="mb-1 h-[3px] w-5 rounded-sm"
                    style={{ background: accentFor(first.slug) }}
                  />
                  <div className="flex items-center justify-between gap-1">
                    <span className={`num text-[10px] sm:text-[13px] ${ratingColor(first.rating)}`}>
                      {first.rating !== null ? formatTenths(first.rating) : ""}
                    </span>
                    {films.some((f) => f.rewatch) && (
                      <span className="text-[9px] text-beam" title="Rewatch">
                        ↺
                      </span>
                    )}
                    {films.length > 1 && (
                      <span className="num text-[9px] text-dim">+{films.length - 1}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
          return first ? (
            <button
              key={day}
              type="button"
              onClick={() => setOpenDay(day)}
              title={films.map((f) => f.title).join(", ")}
              className="block text-left"
            >
              {cell}
            </button>
          ) : (
            <div key={day}>{cell}</div>
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
                      {f.rewatch && <span className="text-[10px] text-beam">↺ rewatch</span>}
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
                      {r.rewatch && <span className="text-[10px] text-beam">↺ rewatch</span>}
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
