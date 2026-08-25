"use client";

import { createContext, Fragment, useCallback, useContext, useMemo, useState } from "react";
import { useUrlState, useUrlText } from "@/lib/useUrlState";
import SeriesSheet, { seriesStanding } from "./SeriesSheet";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CaretRight, DotsSixVertical, DotsThree, DotsThreeVertical, Plus } from "@phosphor-icons/react/ssr";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import { useProgressiveList } from "@/lib/useProgressiveList";
import type { LibraryFilm } from "@/lib/library";
import { ratingFromNeighbours, WINDOW } from "@/lib/placement";
import PlaceSheet, { type PlacePayload } from "./PlaceSheet";
import { useToast } from "./Toast";

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

/**
 * Opening a gap, from wherever it happens to be drawn.
 *
 * A context for the same reason the two above are: the callback would otherwise
 * be threaded through the ledger, the shelf and the sortable wrapper, none of
 * which have any interest in what a gap is worth. Null in every view where a
 * position means nothing — a filtered shelf or any sort but the ranking — so
 * the affordance simply is not there rather than recording something else.
 */
const OpenGap = createContext<((above: string | null, below: string | null) => void) | null>(null);

/** The gap between two titles in the ranking, and the way into it. */
function Gap({
  above,
  below,
  variant,
}: {
  /** film ids of the titles this gap sits between; null at either end */
  above: string | null;
  below: string | null;
  variant: "row" | "tile";
}) {
  const open = useContext(OpenGap);
  if (!open) return null;

  if (variant === "tile") {
    return (
      <button
        type="button"
        onClick={() => open(above, below)}
        aria-label="Log a film here"
        className="absolute inset-y-0 -left-7 z-10 flex w-7 items-center justify-center"
      >
        <DotsThreeVertical aria-hidden weight="bold" className="size-5 text-paper" />
      </button>
    );
  }

  return (
    <li className="relative h-0">
      <button
        type="button"
        onClick={() => open(above, below)}
        aria-label="Log a film here"
        className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center px-4 py-2"
      >
        <DotsThree aria-hidden weight="bold" className="size-5 text-paper" />
      </button>
    </li>
  );
}

export default function LibraryView({ films, editable }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [view, setView] = useUrlState<"ledger" | "shelf">("view", "shelf", VIEWS);
  const [filter, setFilter] = useUrlText("q");
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

  /**
   * Placing and re-ranking work under any slice or search, but only in the
   * ranking itself.
   *
   * A filter hides rows without changing what the order means, so the titles
   * either side of a drop are still ranked against each other and the rating
   * read off them is still the answer to "better than these, worse than
   * those" — it is simply asked of the shelf in front of you. A different
   * sort is not the same: under "Title A–Z" a position says nothing about a
   * rating, so a drop there would record a number nobody meant.
   */
  const rankable = editable && sort === "rating";

  /** the gap being filled, named by the two titles it sits between */
  const [gap, setGap] = useState<{ above: string | null; below: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [gapError, setGapError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  /**
   * The rated rows as the shelf currently reads, filter and all.
   *
   * Neighbours are taken from here rather than from the whole library, because
   * a rating read off titles the person cannot see is not the one they meant.
   * Under "Anime" the film above a gap is the anime above it, not whatever the
   * unfiltered ranking happens to hold at that index.
   */
  const rated = useMemo(() => visible.filter((f) => f.rating !== null), [visible]);

  /** the two titles either side of a point in that list, nearest first */
  const neighboursAt = useCallback(
    (aboveId: string | null, belowId: string | null, exclude?: string) => {
      const list = exclude ? rated.filter((f) => f.filmId !== exclude) : rated;
      const at = belowId
        ? list.findIndex((f) => f.filmId === belowId)
        : aboveId
          ? list.findIndex((f) => f.filmId === aboveId) + 1
          : -1;
      if (at < 0) return null;
      return {
        above: list.slice(Math.max(0, at - WINDOW), at).reverse(),
        below: list.slice(at, at + WINDOW),
      };
    },
    [rated],
  );

  const gapNear = gap ? neighboursAt(gap.above, gap.below) : null;
  const suggested = gapNear
    ? ratingFromNeighbours(
        gapNear.above.map((f) => f.rating!),
        gapNear.below.map((f) => f.rating!),
      )
    : null;

  /**
   * Dragging a film to a new place on the shelf, and its rating with it.
   *
   * The number is worked out here and shown immediately, before the request
   * lands, because the point of the gesture is to reorder a shelf of hundreds
   * without stopping. The server works the same rating out again from its own
   * read and is the one that decides; if it disagrees or fails, the shelf goes
   * back to how it was and says so.
   */
  async function moveOnShelf(activeId: string, overId: string) {
    const from = rated.findIndex((f) => f.filmId === activeId);
    const to = rated.findIndex((f) => f.filmId === overId);
    if (from < 0 || to < 0 || from === to) return;

    // the shelf as it will read once the film has landed, so it is never
    // counted as one of its own neighbours
    const moved = arrayMove(rated, from, to);
    const at = moved.findIndex((f) => f.filmId === activeId);
    const rest = moved.filter((f) => f.filmId !== activeId);
    const above = rest.slice(Math.max(0, at - WINDOW), at).reverse();
    const below = rest.slice(at, at + WINDOW);
    const rating = ratingFromNeighbours(
      above.map((f) => f.rating!),
      below.map((f) => f.rating!),
    );
    if (rating === null) return;

    const before = items;
    /**
     * Rewrite only the slots the filtered rows already occupy.
     *
     * Sorting the whole library by the new order would send everything the
     * filter is hiding to the back, because a hidden row has no place in it.
     * The visible rows change places among themselves; nothing else moves.
     */
    const inView = new Set(moved.map((f) => f.filmId));
    const slots: number[] = [];
    items.forEach((f, i) => {
      if (inView.has(f.filmId)) slots.push(i);
    });
    const next = [...items];
    moved.forEach((f, i) => {
      next[slots[i]] = f.filmId === activeId ? { ...f, rating } : f;
    });
    setItems(next);

    try {
      const res = await fetch("/api/library/rerank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filmId: activeId,
          above: above.map((f) => f.filmId),
          below: below.map((f) => f.filmId),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setItems(before);
        toast({ message: data?.error ?? "That move didn't save.", tone: "warn" });
        return;
      }
      router.refresh();
    } catch {
      setItems(before);
      toast({ message: "Couldn't reach the server. That move didn't save.", tone: "warn" });
    }
  }

  async function logIntoGap(payload: PlacePayload) {
    setBusy(true);
    setGapError(null);
    try {
      const res = await fetch("/api/library/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: payload.film.tmdbId,
          kind: payload.film.kind,
          above: (gapNear?.above ?? []).map((f) => f.filmId),
          below: (gapNear?.below ?? []).map((f) => f.filmId),
          rating: payload.rating,
          watchedOn: payload.watchedOn,
          review: payload.review,
          spoiler: payload.spoiler,
          private: payload.private,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; rating?: number | null }
        | null;
      if (!res.ok) {
        setGapError(data?.error ?? "That didn't save. Try again.");
        return;
      }
      const at = data?.rating;
      toast({
        message: `Logged ${payload.film.title}${at != null ? ` · ${formatTenths(at)}` : ""}`,
      });
      setGap(null);
      router.refresh();
    } catch {
      setGapError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

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
  const { visible: shown, hasMore, total, sentinelRef, showMore } = useProgressiveList(
    visible,
    30,
    memory,
  );

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
          <OpenGap.Provider value={rankable ? (a, b) => setGap({ above: a, below: b }) : null}>
          <OpenSeries.Provider value={setOpenShowId}>
          <MatchQuery.Provider value={filter.trim().toLowerCase()}>
          {view === "ledger" ? (
            dragEnabled ? (
              <RankedLedger films={shown} onReorder={setItems} all={items} />
            ) : (
              <FlatLedger films={shown} showRank={sort === "rating"} />
            )
          ) : (
            <Shelf films={shown} sortable={rankable} onMove={moveOnShelf} />
          )}
          </MatchQuery.Provider>
          </OpenSeries.Provider>
          </OpenGap.Provider>
        </div>
      )}

      {visible.length > 0 && (
        <>
          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="num text-[11px] text-dim">
              Showing {shown.length} of {total}
            </p>
            {hasMore && (
              <button
                type="button"
                onClick={showMore}
                className="rounded-card border border-seam bg-tray px-3 py-1.5 text-[13px] text-ash transition-colors hover:border-beam-edge hover:text-paper"
              >
                Show more
              </button>
            )}
          </div>
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

      <PlaceSheet
        open={gap !== null}
        onClose={() => setGap(null)}
        suggested={suggested}
        between={{
          above: gapNear?.above[0]?.title ?? null,
          below: gapNear?.below[0]?.title ?? null,
        }}
        busy={busy}
        error={gapError}
        onSubmit={logIntoGap}
      />
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
        // `rank` is 1-based over the rated run, so `rank - 1` is the index the
        // row sits at and therefore the index a gap above it would insert into.
        const content = rows.map(({ film, rank }) => (
          <Fragment key={film.filmId}>
            <Gap above={rated[rank - 2]?.filmId ?? null} below={film.filmId} variant="row" />
            <LedgerRow film={film} rank={rank} draggable={tie} />
          </Fragment>
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
      <Gap above={rated[rated.length - 1]?.filmId ?? null} below={null} variant="row" />
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

function ShelfCell({
  film,
  aboveId,
  sortable,
}: {
  film: LibraryFilm;
  /** the rated title immediately before this one, as the shelf is currently filtered */
  aboveId: string | null;
  sortable: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: film.filmId,
    // an unrated row has no place in the ranking, so there is nothing for a
    // drop to read a rating from
    disabled: !sortable || film.rating === null,
  });
  const draggable = sortable && film.rating !== null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative ${isDragging ? "z-30 opacity-80" : ""}`}
    >
      {film.rating !== null && <Gap above={aboveId} below={film.filmId} variant="tile" />}
      {draggable && (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${film.title}`}
          className="absolute right-0 top-0 z-20 flex size-9 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        >
          {/*
            A corner wash, not a shadow. The system has no shadow vocabulary and
            on a near-black ground one reads as blur; a gradient scrim is how
            this shelf already makes a control legible over artwork, which is
            the same problem the season count solves at the other corner.
          */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-tr-card bg-gradient-to-bl from-[rgba(14,14,16,.92)] via-[rgba(14,14,16,.45)] to-transparent"
          />
          <DotsSixVertical aria-hidden weight="bold" className="relative size-4 text-paper" />
        </button>
      )}
      <ShelfTile film={film} />
    </li>
  );
}

function Shelf({
  films,
  sortable,
  onMove,
}: {
  films: LibraryFilm[];
  /** dragging only means something in the canonical ranking, same as the gaps */
  sortable: boolean;
  onMove: (activeId: string, overId: string) => void;
}) {
  const openGap = useContext(OpenGap);
  const ratedRows = films.filter((f) => f.rating !== null);
  const rated = ratedRows.length;
  const lastRatedId = ratedRows[rated - 1]?.filmId ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const grid = (
    <ul className="fade-up grid grid-cols-3 gap-x-7 gap-y-5 px-7 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {films.map((film, i) => (
        <ShelfCell
          key={film.filmId}
          film={film}
          aboveId={films[i - 1]?.rating != null ? films[i - 1].filmId : null}
          sortable={sortable}
        />
      ))}
      {openGap && rated > 0 && (
        <li>
          <button
            type="button"
            onClick={() => openGap(lastRatedId, null)}
            aria-label="Log a film at the end"
            className="group flex aspect-[2/3] w-full items-center justify-center rounded-card border border-seam bg-lift transition-colors hover:border-beam-edge hover:bg-tray"
          >
            <Plus
              aria-hidden
              weight="bold"
              className="size-5 text-paper transition-colors group-hover:text-beam"
            />
          </button>
        </li>
      )}
    </ul>
  );

  if (!sortable) return grid;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
      }}
    >
      <SortableContext items={films.map((f) => f.filmId)} strategy={rectSortingStrategy}>
        {grid}
      </SortableContext>
    </DndContext>
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

  // The `li` belongs to the shelf, which also draws the gap beside this tile.
  return (
    <div className="group">
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
    </div>
  );
}
