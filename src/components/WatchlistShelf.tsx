"use client";

/**
 * THESIS: the watchlist is where you *choose*, so the thing you choose from
 * leads — posters at real size on a shelf. It refuses the category default this
 * page shipped with: a text row list that shrinks the only colour the product
 * has to a 44x66 thumbnail beside its own metadata.
 * OWN-WORLD: the app's projection-room graphite, unchanged. Chrome stays quiet
 * — graphite tiles, hairline seams, tracked micro-caps — and every colour on
 * screen comes from the posters, which is DESIGN.md's own rule for this world.
 * STORY: the reader scans a wall of covers, narrows it by what they can
 * actually act on tonight, and either opens one or marks it watched.
 * FIRST VIEWPORT: a filter bar one line high, then the shelf, densest thing on
 * the page. Every tile carries its own two actions.
 * FORM: poster shelf, candidate 4 of the grounded list, seed key 6e482b37.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 * finish review, the verdict, and DESIGN.md.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowsDownUp, DotsSixVertical, MagnifyingGlass, X } from "@phosphor-icons/react/ssr";
import LogSheet, { type LogPayload } from "./LogSheet";
import { useToast } from "./Toast";
import { formatTenths } from "@/lib/format";
import { errorFrom } from "@/lib/http";
import { posterUrl } from "@/lib/tmdb-urls";
import { useUrlState, useUrlText } from "@/lib/useUrlState";

export type ShelfItem = {
  filmId: string;
  href: string;
  title: string;
  /** the season within a series; null for a film or a whole series */
  part: string | null;
  kind: "film" | "season" | "series";
  year: number | null;
  director: string | null;
  posterPath: string | null;
  runtime: number | null;
  addedAt: string;
  unreleased: boolean;
};

type Sort = "mine" | "added" | "title" | "year" | "runtime";

const SORTS: { value: Sort; label: string }[] = [
  { value: "mine", label: "Your order" },
  { value: "added", label: "Newest" },
  { value: "title", label: "A–Z" },
  { value: "year", label: "Year" },
  { value: "runtime", label: "Shortest" },
];

const KINDS = [
  { value: "all", label: "Everything" },
  { value: "film", label: "Films" },
  { value: "tv", label: "Television" },
] as const;

type KindFilter = (typeof KINDS)[number]["value"];

const SORT_KEYS = SORTS.map((s) => s.value);
const KIND_KEYS = KINDS.map((k) => k.value);
const UNRELEASED_KEYS = ["all", "hide"] as const;

function runtimeLabel(mins: number | null): string | null {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m ? `${m}m` : ""}`.trim() : `${m}m`;
}

export default function WatchlistShelf({ items }: { items: ShelfItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState(items);
  const [prev, setPrev] = useState(items);
  if (items !== prev) {
    setPrev(items);
    setRows(items);
  }

  const [rating, setRating] = useState<ShelfItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * In the address bar, not in this component.
   *
   * Opening a film unmounts the shelf, so a filter held here was gone by the
   * time you came back — and the restored scroll position then pointed into a
   * list that no longer had those rows in it.
   */
  const [query, setQuery] = useUrlText("q");
  const [sort, setSort] = useUrlState<Sort>("sort", "mine", SORT_KEYS);
  const [kind, setKind] = useUrlState<KindFilter>("show", "all", KIND_KEYS);
  const [unreleased, setUnreleased] = useUrlState<"all" | "hide">("out", "all", UNRELEASED_KEYS);
  const hideUnreleased = unreleased === "hide";
  const setHideUnreleased = (next: boolean) => setUnreleased(next ? "hide" : "all");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const unreleasedCount = useMemo(() => rows.filter((r) => r.unreleased).length, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (kind === "film" && r.kind !== "film") return false;
      if (kind === "tv" && r.kind === "film") return false;
      if (hideUnreleased && r.unreleased) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.director?.toLowerCase().includes(q) ?? false) ||
        (r.part?.toLowerCase().includes(q) ?? false)
      );
    });
    if (sort !== "mine") {
      list = [...list].sort((a, b) => {
        switch (sort) {
          case "added":
            return b.addedAt.localeCompare(a.addedAt);
          case "title":
            return a.title.localeCompare(b.title);
          case "year":
            return (b.year ?? 0) - (a.year ?? 0);
          case "runtime":
            // Anything with no runtime on file sorts last rather than first,
            // where a zero would put it.
            return (a.runtime || Infinity) - (b.runtime || Infinity);
        }
      });
    }
    return list;
  }, [rows, query, sort, kind, hideUnreleased]);

  /**
   * Dragging is only honest while the shelf is in your order.
   *
   * The old list silently disabled reordering whenever grouping was on, so a
   * drag that did nothing looked like a bug. Here the state is named on screen
   * and comes with the way back.
   */
  const filtered = kind !== "all" || hideUnreleased || query.trim() !== "";
  const canReorder = sort === "mine" && !filtered;

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.filmId === active.id);
    const to = rows.findIndex((r) => r.filmId === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(rows, from, to);
    setRows(next);
    await fetch("/api/watchlist/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedFilmIds: next.map((r) => r.filmId) }),
    }).catch(() => {});
  }

  async function remove(item: ShelfItem) {
    setRows((list) => list.filter((r) => r.filmId !== item.filmId));
    const res = await fetch("/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filmId: item.filmId }),
    }).catch(() => null);
    if (!res?.ok) {
      setRows(items);
      toast({ message: "Couldn't remove that.", tone: "warn" });
      return;
    }
    toast({ message: `Removed ${item.title}` });
    router.refresh();
  }

  /** Rating from here means you've watched it, so it moves to the diary. */
  async function logIt(payload: LogPayload) {
    if (!rating) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId: rating.filmId, ...payload }),
      });
      if (!res.ok) {
        setError(await errorFrom(res, "That didn't save. Try again."));
        return;
      }
      await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId: rating.filmId }),
      }).catch(() => {});

      setRows((list) => list.filter((r) => r.filmId !== rating.filmId));
      toast({
        message: (
          <>
            Moved <b>{rating.title}</b> to your diary
            {payload.rating !== null && (
              <>
                {" · "}
                <span className="num text-gold">{formatTenths(payload.rating)}</span>
              </>
            )}
          </>
        ),
        action: { label: "View in diary", href: "/diary" },
      });
      setRating(null);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function clearFilters() {
    setQuery("");
    setKind("all");
    setHideUnreleased(false);
    setSort("mine");
  }

  if (items.length === 0) {
    return (
      <div>
        <Header count={0} />
        <div className="mt-8 max-w-[52ch]">
          <p className="display text-[19px] text-paper">Nothing queued yet.</p>
          <p className="mt-2 text-sm leading-relaxed text-ash">
            Add a film or a season from its page and it lands here, in the order you mean to get
            to it. When you have watched one, mark it and it moves straight to your diary.
          </p>
          <Link
            href="/browse"
            className="mt-4 inline-flex items-center rounded-card bg-paper px-4 py-2 text-sm font-medium text-carbon transition-colors hover:bg-white"
          >
            Find something
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header count={rows.length} />

      {/* controls */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <MagnifyingGlass
            aria-hidden
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dim"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or director"
            aria-label="Search your watchlist"
            className="w-full rounded-card border border-seam bg-tray py-1.5 pl-8 pr-2.5 text-sm text-paper placeholder:text-dim focus:border-edge"
          />
        </label>

        <Segmented
          label="Show"
          value={kind}
          options={KINDS.map((k) => ({ value: k.value, label: k.label }))}
          onChange={(v) => setKind(v as KindFilter)}
        />

        <label className="flex items-center gap-1.5 rounded-card border border-seam bg-tray px-2.5 py-1.5 text-sm text-ash">
          <ArrowsDownUp aria-hidden size={14} className="text-dim" />
          <span className="sr-only">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="bg-transparent text-sm text-paper outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value} className="bg-tray">
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {unreleasedCount > 0 && (
          <Toggle
            pressed={hideUnreleased}
            onClick={() => setHideUnreleased(!hideUnreleased)}
            label={`Hide ${unreleasedCount} not out yet`}
          />
        )}
      </div>

      {/* The one state the old list left unexplained. */}
      <p className="mt-3 text-xs text-dim">
        {canReorder ? (
          <>Drag a poster to set the order you mean to watch them in.</>
        ) : (
          <>
            {shown.length} of {rows.length} shown · reordering is off while the shelf is filtered
            or sorted.{" "}
            <button
              type="button"
              onClick={clearFilters}
              className="text-ash underline underline-offset-4 hover:text-paper"
            >
              Back to your order
            </button>
          </>
        )}
      </p>

      {shown.length === 0 ? (
        <div className="mt-6">
          <p className="text-sm text-paper">Nothing here matches that.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-1.5 text-sm text-ash underline underline-offset-4 hover:text-paper"
          >
            Clear the filters
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={shown.map((r) => r.filmId)} strategy={rectSortingStrategy}>
            <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(124px,1fr))] gap-x-4 gap-y-6">
              {shown.map((item) => (
                <Tile
                  key={item.filmId}
                  item={item}
                  sortable={canReorder}
                  onRate={() => setRating(item)}
                  onRemove={() => remove(item)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {rating && (
        <LogSheet
          open
          onClose={() => setRating(null)}
          film={rating}
          isRewatch={false}
          busy={busy}
          error={error}
          onSubmit={logIt}
        />
      )}
    </div>
  );
}

function Header({ count }: { count: number }) {
  return (
    <div>
      <h1 className="display text-2xl text-paper">Watchlist</h1>
      <p className="mt-1 text-sm text-ash">
        {count > 0 ? (
          <>
            <span className="num">{count}</span> waiting, in the order you mean to get to them.
          </>
        ) : (
          <>What you mean to get to, in the order you mean to get to it.</>
        )}
      </p>
    </div>
  );
}

function Toggle({
  pressed,
  onClick,
  label,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`max-w-[14rem] truncate rounded-full border px-2.5 py-1 text-xs transition-colors ${
        pressed
          ? "border-paper bg-paper text-carbon"
          : "border-seam bg-tray text-ash hover:border-edge hover:text-paper"
      }`}
    >
      {label}
    </button>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-card border border-seam bg-tray p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-[4px] px-2.5 py-1 text-xs transition-colors ${
            value === o.value ? "bg-tray-2 text-paper" : "text-ash hover:text-paper"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Tile({
  item,
  sortable,
  onRate,
  onRemove,
}: {
  item: ShelfItem;
  sortable: boolean;
  onRate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.filmId,
    disabled: !sortable,
  });
  const poster = posterUrl(item.posterPath, "w342");
  const runtime = runtimeLabel(item.runtime);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative ${isDragging ? "z-10 opacity-90" : ""}`}
    >
      <Link
        href={item.href}
        className="block focus-visible:outline-none"
        aria-label={`${item.title}${item.part ? `, ${item.part}` : ""}`}
      >
        <div
          className={`relative overflow-hidden rounded-card border bg-tray transition-colors ${
            isDragging ? "border-edge" : "border-seam group-hover:border-edge"
          }`}
          style={{ aspectRatio: "2 / 3" }}
        >
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              loading="lazy"
              draggable={false}
              className="size-full object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center px-2 text-center text-[11px] leading-snug text-dim">
              {item.title}
            </span>
          )}

          {/* A season and a whole series are different things on the same
              poster art, so the badge says which. Films carry no badge: the
              absence is the answer, and eleven identical "Film" chips would be
              noise on a shelf that is mostly films. */}
          {/* The two corners the controls do not own. Handle and remove sit
              along the top, so anything the poster has to say goes below them
              — and the two markers take a corner each, so a season that has
              not aired can carry both without either one covering the other. */}
          {item.kind !== "film" && (
            <span className="absolute bottom-1.5 right-1.5 max-w-[calc(100%-1rem)] truncate rounded-[3px] bg-[rgba(8,8,10,.82)] px-1.5 py-0.5 text-[10px] uppercase tracking-[.1em] text-paper backdrop-blur-[2px]">
              {item.kind === "season" ? item.part : "Series"}
            </span>
          )}

          {item.unreleased && (
            <span className="absolute bottom-1.5 left-1.5 rounded-[3px] bg-[rgba(8,8,10,.82)] px-1.5 py-0.5 text-[10px] uppercase tracking-[.1em] text-gold backdrop-blur-[2px]">
              Not out yet
            </span>
          )}
        </div>
      </Link>

      {/* Actions ride the poster, and they are always present rather than
          revealed on hover: a control that only exists under a cursor does not
          exist on a phone, which is how the old drag handle went missing. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-1.5">
        {sortable ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${item.title}`}
            className="pointer-events-auto cursor-grab touch-none rounded-[4px] bg-[rgba(8,8,10,.72)] p-1 text-ash backdrop-blur-[2px] transition-colors hover:text-paper active:cursor-grabbing"
          >
            <DotsSixVertical aria-hidden size={14} weight="bold" />
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.title} from your watchlist`}
          className="pointer-events-auto rounded-[4px] bg-[rgba(8,8,10,.72)] p-1 text-ash backdrop-blur-[2px] transition-colors hover:text-warn"
        >
          <X aria-hidden size={14} weight="bold" />
        </button>
      </div>

      <div className="mt-2">
        <Link
          href={item.href}
          className="block truncate text-[13px] leading-tight text-paper hover:underline"
        >
          {item.title}
        </Link>
        <p className="mt-0.5 truncate text-[11px] leading-tight text-card-3">
          {[item.part, item.year ? String(item.year) : null, runtime].filter(Boolean).join(" · ")}
        </p>
        {item.director && (
          <p className="truncate text-[11px] leading-tight text-dim">{item.director}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={onRate}
            className="inline-flex items-center rounded-card border border-seam bg-tray px-2 py-1 text-[11px] text-paper transition-colors hover:border-edge hover:bg-tray-2"
          >
            Watched it?
          </button>
        </div>
      </div>
    </li>
  );
}
