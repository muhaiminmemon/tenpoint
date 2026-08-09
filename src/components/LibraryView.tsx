"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useUrlState } from "@/lib/useUrlState";
import SeriesSheet, { seriesStanding } from "./SeriesSheet";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/ssr";
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
  | "most-watched"
  | "unfinished";

/** The allow-lists the URL is validated against, so a hand-typed value cannot
    put the view into a state the component never handles. */
const VIEWS = ["shelf", "ledger"] as const;
const SORT_MODES = [
  "rating",
  "rating-asc",
  "title",
  "year-new",
  "year-old",
  "recent",
  "most-watched",
  "unfinished",
] as const;

const SORT_LABELS: Record<SortMode, string> = {
  rating: "Rating, high to low",
  "rating-asc": "Rating, low to high",
  title: "Title A–Z",
  "year-new": "Year, newest first",
  "year-old": "Year, oldest first",
  recent: "Recently watched",
  "most-watched": "Most watched",
  unfinished: "Unfinished series first",
};

/** One-tap slices of the collection, in place of a stack of dropdowns. */
type SavedView =
  | "all"
  | "movies"
  | "shows"
  | "anime"
  | "great"
  | "thisYear"
  | "rewatched"
  | "unrated";

const SAVED_VIEWS: { key: SavedView; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "movies", label: "Films" },
  { key: "shows", label: "Shows" },
  /**
   * Anime overlaps Films and Shows rather than partitioning them.
   *
   * Anime is a kind of show here, not a peer of film and television, so an
   * anime series still counts under Shows and an anime film still counts under
   * Films. This slice only asks a different question of the same shelf.
   */
  { key: "anime", label: "Anime" },
  { key: "great", label: "8.0+" },
  { key: "thisYear", label: "This year" },
  { key: "rewatched", label: "Rewatched" },
  { key: "unrated", label: "No rating" },
];

const SAVED_KEYS = SAVED_VIEWS.map((v) => v.key);

/**
 * Anything that isn't a film.
 *
 * Normally that is one collapsed series row. It also covers the bare season
 * and whole-series rows a caller sees when it asked not to collapse, so the
 * Films chip cannot quietly count a series as a film either way.
 */
const isTelevision = (x: LibraryFilm) => x.kind !== "movie";

/**
 * The active filter text, so a row can say why it is on screen.
 *
 * Filtering on cast means a search for an actor returns films whose titles
 * have nothing to do with what was typed, and a list that answers "Pacino"
 * with eleven unexplained titles looks broken rather than thorough. A row that
 * matched on a name prints that name in place of the director.
 *
 * A context rather than a prop: the query would otherwise be threaded through
 * three layout components that have no interest in it.
 */
const MatchQuery = createContext("");

/**
 * Opening a series, from wherever its row happens to be drawn.
 *
 * A context for the same reason the query above is one: the callback would
 * otherwise be threaded through the ledger, the shelf and the sortable
 * wrapper, none of which have any interest in television.
 */
const OpenSeries = createContext<((showId: string) => void) | null>(null);

export default function LibraryView({ films, editable }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [view, setView] = useUrlState<"ledger" | "shelf">("view", "shelf", VIEWS);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useUrlState<SortMode>("sort", "rating", SORT_MODES);
  const [saved, setSaved] = useUrlState<SavedView>("show", "all", SAVED_KEYS);
  const [items, setItems] = useState(films);
  const [prevFilms, setPrevFilms] = useState(films);
  if (films !== prevFilms) {
    // server sent fresh data (rating changed, entry added), so drop local copy
    setPrevFilms(films);
    setItems(films);
  }

  /**
   * Which series is open, held as an id rather than as the series itself.
   *
   * Rating a season from inside the panel refetches the page, and a panel
   * holding a copy of the row it was opened from would go on showing the
   * ratings as they were before the edit. Looking it up every render means the
   * open panel is the same data as the row underneath it, always.
   */
  const [openShowId, setOpenShowId] = useState<string | null>(null);
  const openSeries =
    openShowId === null
      ? null
      : (items.find((f) => f.series?.showId === openShowId)?.series ?? null);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let out = items;
    if (q) {
      out = out.filter(
        (x) =>
          x.title.toLowerCase().includes(q) ||
          (x.director ?? "").toLowerCase().includes(q) ||
          x.cast.some((c) => c.toLowerCase().includes(q)),
      );
    }
    const thisYear = String(new Date().getFullYear());
    // Films against series, first, because it is the widest cut anybody makes
    // and every other view reads better inside one of them.
    if (saved === "movies") out = out.filter((x) => x.kind === "movie");
    if (saved === "shows") out = out.filter(isTelevision);
    if (saved === "anime") out = out.filter((x) => x.isAnime);
    if (saved === "great") out = out.filter((x) => x.rating !== null && x.rating >= 80);
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
          /**
           * What am I part-way through: the one question a rating-ranked list
           * cannot answer, and the only reason the separate series shelf
           * existed. It is a sort here instead of a second component, so the
           * search box, the view toggle and the count keep working while it is
           * on.
           */
          case "unfinished": {
            const rank = (x: LibraryFilm) =>
              x.series?.state === "unfinished" ? 0 : x.series?.state === "caughtup" ? 1 : x.series ? 2 : 3;
            return (
              rank(a) - rank(b) ||
              (b.lastWatched ?? "").localeCompare(a.lastWatched ?? "") ||
              a.title.localeCompare(b.title)
            );
          }
          default:
            return 0;
        }
      });
    }
    return out;
  }, [items, filter, saved, sort]);

  // manual tie-reorder only makes sense in the default ranking with nothing hidden
  const dragEnabled = editable && sort === "rating" && !filter && saved === "all";

  const counts = useMemo(() => {
    const thisYear = String(new Date().getFullYear());
    return {
      all: items.length,
      movies: items.filter((x) => x.kind === "movie").length,
      shows: items.filter(isTelevision).length,
      anime: items.filter((x) => x.isAnime).length,
      great: items.filter((x) => x.rating !== null && x.rating >= 80).length,
      thisYear: items.filter((x) => x.lastWatched?.startsWith(thisYear)).length,
      rewatched: items.filter((x) => x.rewatched).length,
      unrated: items.filter((x) => x.rating === null).length,
    } satisfies Record<SavedView, number>;
  }, [items]);

  // Keyed on the whole query, since a different sort or slice is a different
  // list and its slice count is not this one's. Scroll position is handled for
  // every route at once in the layout.
  const memory = `${pathname}?${params.toString()}`;
  const { visible: shown, hasMore, total, sentinelRef } = useProgressiveList(visible, 30, memory);

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
          placeholder="Title, director or cast"
          aria-label="Filter library by title, director or cast"
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
        <p className="py-8 text-sm text-ash">Nothing matches those filters.</p>
      ) : (
        // Keyed so switching between the shelf and the ledger plays an
        // entrance. The height is deliberately not eased: these lists run to
        // hundreds of rows, and animating between two of them would be a long
        // slow scroll nobody asked for.
        <div key={view} className="pop-in">
          <OpenSeries.Provider value={setOpenShowId}>
          <MatchQuery.Provider value={filter.trim().toLowerCase()}>
          {view === "ledger" ? (
            dragEnabled ? (
              <RankedLedger films={shown} onReorder={setItems} all={items} />
            ) : (
              <FlatLedger films={shown} showRank={sort === "rating"} />
            )
          ) : (
            <Shelf films={shown} />
          )}
          </MatchQuery.Provider>
          </OpenSeries.Provider>
        </div>
      )}

      {visible.length > 0 && (
        <>
          <p className="num mt-4 text-center text-[11px] text-dim">
            Showing {shown.length} of {total}
          </p>
          {hasMore && <div ref={sentinelRef} aria-hidden className="h-1" />}
        </>
      )}

      {openSeries && (
        <SeriesSheet
          series={openSeries}
          editable={editable}
          onClose={() => setOpenShowId(null)}
        />
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

/** The cast member the current filter matched, when that is why a row is here. */
function useBilledMatch(film: LibraryFilm): string | null {
  const q = useContext(MatchQuery);
  if (!q) return null;
  // Only when the obvious fields miss. A search for "Nolan" that already
  // matched the director should keep saying so.
  if (film.title.toLowerCase().includes(q)) return null;
  if ((film.director ?? "").toLowerCase().includes(q)) return null;
  return film.cast.find((c) => c.toLowerCase().includes(q)) ?? null;
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
  const billed = useBilledMatch(film);
  const openSeries = useContext(OpenSeries);

  /**
   * What the second line says, which is not the same question for the two.
   *
   * A film is placed by when it was made and who made it. A series is placed
   * by how far through it you are, which is the only thing about a programme
   * that a shelf cannot show and a viewer actually wants.
   */
  const subline = film.series
    ? [
        film.year,
        seriesStanding(film.series),
        film.series.nextSeason !== null ? `next up season ${film.series.nextSeason}` : null,
      ]
    : [
        film.year,
        billed ? `with ${billed}` : film.director,
        film.entryCount > 1 ? `watched ${film.entryCount}×` : null,
      ];

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
        {film.series ? (
          // A series opens rather than navigates: its seasons are the thing
          // being asked for, and they are one panel away instead of a page.
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => openSeries?.(film.series!.showId)}
            className="flex min-w-0 max-w-full items-center gap-1 rounded-card text-left text-paper hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-beam-edge"
          >
            <span className="truncate">{film.title}</span>
            <CaretRight aria-hidden className="size-3 shrink-0 text-dim" />
          </button>
        ) : (
          <Link href={`/film/${film.slug}`} className="block truncate text-paper hover:underline">
            {film.title}
          </Link>
        )}
        <span className="block truncate text-xs text-ash">
          {subline.filter(Boolean).join("  ·  ")}
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

function Shelf({ films }: { films: LibraryFilm[] }) {
  return (
    <ul className="fade-up grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {films.map((film) => (
        <ShelfTile key={film.filmId} film={film} />
      ))}
    </ul>
  );
}

function ShelfTile({ film }: { film: LibraryFilm }) {
  const poster = posterUrl(film.posterPath, "w342");
  const billed = useBilledMatch(film);
  const openSeries = useContext(OpenSeries);
  const series = film.series;

  const content = (
    <>
      <span className="relative block">
        {/* Two tonal edges behind the poster's right side.
         *
         * A series is a stack of things, so the tile is a stack of things.
         * The count used to be a nine-character string set at 10px — the floor
         * of the page ramp, unadorned, over artwork — because a chip that says
         * "6 seasons" has to stay small to keep out of the poster's way. Once
         * the shape says "series", the numeral is free to be a numeral and the
         * word demotes to a label. */}
        {series && series.totalSeasons > 1 && (
          <>
            <span aria-hidden className="absolute inset-y-2 right-[-3px] w-[3px] rounded-r-card bg-tray-2" />
            <span aria-hidden className="absolute inset-y-4 right-[-6px] w-[3px] rounded-r-card bg-seam" />
          </>
        )}
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={`Poster for ${film.title}`}
            loading="lazy"
            className="relative aspect-[2/3] w-full rounded-card bg-tray object-cover"
          />
        ) : (
          <span className="relative flex aspect-[2/3] w-full items-center justify-center rounded-card bg-tray p-2 text-center text-sm text-ash">
            {film.title}
          </span>
        )}
        {series && series.totalSeasons > 0 && (
          <span className="absolute inset-x-0 bottom-0 flex items-end rounded-b-card bg-gradient-to-t from-[rgba(14,14,16,.92)] via-[rgba(14,14,16,.5)] to-transparent px-2 pb-1.5 pt-7">
            <span className="num text-[22px] leading-none text-paper">
              {series.totalSeasons}
            </span>
            <span className="mb-[3px] ml-1.5 text-[10px] uppercase leading-none tracking-[.14em] text-ash">
              {series.totalSeasons === 1 ? "season" : "seasons"}
            </span>
          </span>
        )}
      </span>
      <span className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="truncate text-xs text-ash">{film.title}</span>
        <span className={`num text-sm ${ratingColor(film.rating)}`}>
          {film.rating !== null ? formatTenths(film.rating) : ""}
        </span>
      </span>
      {series ? (
        <span className="mt-0.5 block truncate text-[11px] text-dim">
          {seriesStanding(series)}
        </span>
      ) : (
        billed && <span className="mt-0.5 block truncate text-[11px] text-dim">with {billed}</span>
      )}
    </>
  );

  return (
    <li className="group relative">
      {series ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`${film.title}, ${seriesStanding(series).toLowerCase()}`}
          onClick={() => openSeries?.(series.showId)}
          className="block w-full rounded-card text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-beam-edge"
        >
          {content}
        </button>
      ) : (
        <Link href={`/film/${film.slug}`} className="block">
          {content}
        </Link>
      )}
    </li>
  );
}
