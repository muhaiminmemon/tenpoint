"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import { useProgressiveList } from "@/lib/useProgressiveList";
import type { LibraryFilm } from "@/lib/library";

type Props = {
  films: LibraryFilm[];
  /** drag-to-reorder ties and edit links; false on public profiles */
  editable: boolean;
};

type SortMode =
  | "rating"
  | "rating-asc"
  | "title"
  | "year-new"
  | "year-old"
  | "recent"
  | "most-watched";

const SORT_LABELS: Record<SortMode, string> = {
  rating: "Rating, high to low",
  "rating-asc": "Rating, low to high",
  title: "Title A–Z",
  "year-new": "Year, newest first",
  "year-old": "Year, oldest first",
  recent: "Recently watched",
  "most-watched": "Most watched",
};

/** One-tap slices of the collection, in place of a stack of dropdowns. */
type SavedView = "all" | "great" | "favourites" | "thisYear" | "rewatched" | "unrated";

const SAVED_VIEWS: { key: SavedView; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "great", label: "8.0+" },
  { key: "favourites", label: "Favourites" },
  { key: "thisYear", label: "This year" },
  { key: "rewatched", label: "Rewatched" },
  { key: "unrated", label: "No rating" },
];

export default function LibraryView({ films, editable }: Props) {
  const [view, setView] = useState<"ledger" | "shelf">("shelf");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortMode>("rating");
  const [saved, setSaved] = useState<SavedView>("all");
  const [items, setItems] = useState(films);
  const [prevFilms, setPrevFilms] = useState(films);
  if (films !== prevFilms) {
    // server sent fresh data (rating changed, entry added), so drop local copy
    setPrevFilms(films);
    setItems(films);
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let out = items;
    if (q) {
      out = out.filter(
        (x) =>
          x.title.toLowerCase().includes(q) ||
          (x.director ?? "").toLowerCase().includes(q),
      );
    }
    const thisYear = String(new Date().getFullYear());
    if (saved === "great") out = out.filter((x) => x.rating !== null && x.rating >= 80);
    if (saved === "favourites") out = out.filter((x) => x.favourite);
    if (saved === "thisYear") out = out.filter((x) => x.lastWatched?.startsWith(thisYear));
    if (saved === "rewatched") out = out.filter((x) => x.rewatched);
    if (saved === "unrated") out = out.filter((x) => x.rating === null);

    if (sort !== "rating") {
      out = [...out].sort((a, b) => {
        switch (sort) {
          case "rating-asc":
            return (a.rating ?? 999) - (b.rating ?? 999) || a.title.localeCompare(b.title);
          case "title":
            return a.title.localeCompare(b.title);
          case "year-new":
            return (b.year ?? -1) - (a.year ?? -1) || a.title.localeCompare(b.title);
          case "year-old":
            return (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title);
          case "recent":
            return (b.lastWatched ?? "").localeCompare(a.lastWatched ?? "");
          case "most-watched":
            return b.entryCount - a.entryCount || (b.rating ?? 0) - (a.rating ?? 0);
          default:
            return 0;
        }
      });
    }
    return out;
  }, [items, filter, saved, sort]);

  // manual tie-reorder only makes sense in the default ranking with nothing hidden
  const dragEnabled = editable && sort === "rating" && !filter && saved === "all";

  /** Optimistic favourite toggle; the server call follows. */
  async function toggleFavourite(filmId: string, next: boolean) {
    setItems((list) =>
      list.map((f) => (f.filmId === filmId ? { ...f, favourite: next } : f)),
    );
    await fetch("/api/favourites", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filmId }),
    }).catch(() => {
      setItems((list) =>
        list.map((f) => (f.filmId === filmId ? { ...f, favourite: !next } : f)),
      );
    });
  }

  const counts = useMemo(() => {
    const thisYear = String(new Date().getFullYear());
    return {
      all: items.length,
      great: items.filter((x) => x.rating !== null && x.rating >= 80).length,
      favourites: items.filter((x) => x.favourite).length,
      thisYear: items.filter((x) => x.lastWatched?.startsWith(thisYear)).length,
      rewatched: items.filter((x) => x.rewatched).length,
      unrated: items.filter((x) => x.rating === null).length,
    } satisfies Record<SavedView, number>;
  }, [items]);

  const { visible: shown, hasMore, total, sentinelRef } = useProgressiveList(visible, 30);

  return (
    <div>
      {/* saved views: the slices you actually reach for */}
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Saved views">
        {SAVED_VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-pressed={saved === v.key}
            onClick={() => setSaved(v.key)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
              saved === v.key
                ? "border-paper bg-paper text-carbon"
                : "border-seam bg-tray text-ash hover:text-paper"
            }`}
          >
            {v.label}
            <span className={`num text-[11px] ${saved === v.key ? "text-carbon/60" : "text-dim"}`}>
              {counts[v.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter title or director"
          aria-label="Filter library"
          className="w-48 rounded-card border border-seam bg-tray px-3 py-1.5 text-sm placeholder:text-dim focus:border-beam focus:outline-none"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          aria-label="Sort by"
          className="rounded-card border border-seam bg-tray px-2 py-1.5 text-sm text-paper"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {filter && (
          <button
            type="button"
            onClick={() => setFilter("")}
            className="text-xs text-ash hover:text-paper"
          >
            Clear filter
          </button>
        )}
        <div className="ml-auto flex rounded-card border border-seam text-sm" role="group" aria-label="View">
          {(["shelf", "ledger"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 first:rounded-l-card last:rounded-r-card ${
                view === v ? "bg-tray-2 text-paper" : "text-ash hover:text-paper"
              }`}
            >
              {v === "ledger" ? "Ledger" : "Shelf"}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-sm text-ash">
          {saved === "favourites"
            ? "No favourites yet. Tap the star on a poster to mark one."
            : "No films match those filters."}
        </p>
      ) : view === "ledger" ? (
        dragEnabled ? (
          <RankedLedger films={shown} onReorder={setItems} all={items} />
        ) : (
          <FlatLedger films={shown} showRank={sort === "rating"} />
        )
      ) : (
        <Shelf films={shown} editable={editable} onToggleFavourite={toggleFavourite} />
      )}

      {visible.length > 0 && (
        <>
          <p className="num mt-4 text-center text-[11px] text-dim">
            Showing {shown.length} of {total}
          </p>
          {hasMore && <div ref={sentinelRef} aria-hidden className="h-1" />}
        </>
      )}
    </div>
  );
}

/** Default ranking view: tie groups are drag-reorderable. */
function RankedLedger({
  films,
  onReorder,
  all,
}: {
  films: LibraryFilm[];
  onReorder: (items: LibraryFilm[]) => void;
  all: LibraryFilm[];
}) {
  const rated = films.filter((f) => f.rating !== null);
  const unrated = films.filter((f) => f.rating === null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const groups = useMemo(() => {
    const out: LibraryFilm[][] = [];
    for (const f of rated) {
      const last = out[out.length - 1];
      if (last && last[0].rating === f.rating) last.push(f);
      else out.push([f]);
    }
    return out;
  }, [rated]);

  async function handleDragEnd(event: DragEndEvent, group: LibraryFilm[]) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = group.findIndex((f) => f.filmId === active.id);
    const newIndex = group.findIndex((f) => f.filmId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(group, oldIndex, newIndex);

    const next = [...all];
    const start = next.findIndex((f) => f.filmId === group[0].filmId);
    reordered.forEach((f, i) => (next[start + i] = f));
    onReorder(next);

    await fetch("/api/library/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedFilmIds: reordered.map((f) => f.filmId) }),
    });
  }

  let rank = 0;
  return (
    <ol className="fade-up">
      {groups.map((group) => {
        const tie = group.length > 1;
        const rows = group.map((film) => {
          rank += 1;
          return { film, rank };
        });
        const content = rows.map(({ film, rank }) => (
          <LedgerRow key={film.filmId} film={film} rank={rank} draggable={tie} />
        ));
        return tie ? (
          <DndContext
            key={group[0].filmId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => handleDragEnd(e, group)}
          >
            <SortableContext
              items={group.map((f) => f.filmId)}
              strategy={verticalListSortingStrategy}
            >
              {content}
            </SortableContext>
          </DndContext>
        ) : (
          content
        );
      })}
      {unrated.length > 0 && (
        <>
          <li className="mt-6 mb-2 text-xs uppercase tracking-wide text-ash" aria-hidden>
            Watched, no rating
          </li>
          {unrated.map((film) => (
            <LedgerRow key={film.filmId} film={film} rank={null} draggable={false} />
          ))}
        </>
      )}
    </ol>
  );
}

/** Any other sort/filter combination: a plain list, no drag. */
function FlatLedger({ films, showRank }: { films: LibraryFilm[]; showRank: boolean }) {
  return (
    <ol className="fade-up">
      {films.map((film, i) => (
        <LedgerRow
          key={film.filmId}
          film={film}
          rank={showRank ? i + 1 : null}
          draggable={false}
        />
      ))}
    </ol>
  );
}

function LedgerRow({
  film,
  rank,
  draggable,
}: {
  film: LibraryFilm;
  rank: number | null;
  draggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: film.filmId,
    disabled: !draggable,
  });

  const poster = posterUrl(film.posterPath, "w154");

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-3 border-b border-seam py-2 transition-colors ${
        isDragging ? "z-10 bg-tray-2 relative rounded-card" : "hover:bg-tray/50"
      }`}
    >
      <span className="num w-8 shrink-0 text-right text-xs text-ash">
        {rank ?? ""}
      </span>
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt={`Poster for ${film.title}`}
          loading="lazy"
          className="h-[60px] w-10 shrink-0 rounded-[3px] object-cover bg-tray"
        />
      ) : (
        <span className="h-[60px] w-10 shrink-0 rounded-[3px] bg-tray" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <Link href={`/film/${film.slug}`} className="block truncate text-paper hover:underline">
          {film.title}
          {film.favourite && (
            <span className="ml-1.5 text-gold" title="Favourite" aria-label="Favourite">
              ★
            </span>
          )}
        </Link>
        <span className="block truncate text-xs text-ash">
          {[film.year, film.director].filter(Boolean).join(" · ")}
          {film.entryCount > 1 ? ` · watched ${film.entryCount}×` : ""}
        </span>
      </span>
      {draggable && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${film.title} within its rating group`}
          className="cursor-grab touch-none px-1 text-seam opacity-60 transition-opacity hover:text-ash focus-visible:opacity-100 active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100"
        >
          ⠿
        </button>
      )}
      <span className={`num w-12 shrink-0 text-right text-lg ${ratingColor(film.rating)}`}>
        {film.rating !== null ? formatTenths(film.rating) : ""}
      </span>
    </li>
  );
}

function Shelf({
  films,
  editable,
  onToggleFavourite,
}: {
  films: LibraryFilm[];
  editable: boolean;
  onToggleFavourite: (filmId: string, next: boolean) => void;
}) {
  return (
    <ul className="fade-up grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {films.map((film) => {
        const poster = posterUrl(film.posterPath, "w342");
        return (
          <li key={film.filmId} className="group relative">
            <Link href={`/film/${film.slug}`} className="block">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={poster}
                  alt={`Poster for ${film.title}`}
                  loading="lazy"
                  className="aspect-[2/3] w-full rounded-card bg-tray object-cover"
                />
              ) : (
                <span className="flex aspect-[2/3] w-full items-center justify-center rounded-card bg-tray p-2 text-center text-sm text-ash">
                  {film.title}
                </span>
              )}
              <span className="mt-1.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-xs text-ash">{film.title}</span>
                <span className={`num text-sm ${ratingColor(film.rating)}`}>
                  {film.rating !== null ? formatTenths(film.rating) : ""}
                </span>
              </span>
            </Link>
            {editable && (
              <button
                type="button"
                onClick={() => onToggleFavourite(film.filmId, !film.favourite)}
                aria-pressed={film.favourite}
                aria-label={
                  film.favourite
                    ? `Remove ${film.title} from favourites`
                    : `Mark ${film.title} as a favourite`
                }
                // always visible once set, otherwise revealed on hover/focus
                className={`absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-[rgba(8,8,10,.7)] text-sm backdrop-blur transition-opacity ${
                  film.favourite
                    ? "text-gold opacity-100"
                    : "text-paper opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                }`}
              >
                {film.favourite ? "★" : "☆"}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
