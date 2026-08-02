"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LogSheet, { type LogPayload } from "./LogSheet";
import { useConfirm } from "./Confirm";
import ViewingCard, { type Viewing } from "./ViewingCard";
import { useToast } from "./Toast";
import { formatTenths } from "@/lib/format";
import { errorFrom, readJson } from "@/lib/http";

type Film = {
  id: string;
  title: string;
  year: number | null;
  director: string | null;
  posterPath: string | null;
};

type Props = {
  film: Film;
  /** true while the film is still ahead of its release date */
  unreleased?: boolean;
  entries: Viewing[];
  inWatchlist: boolean;
  watchlistSource: string | null;
  lists: { id: string; title: string; hasFilm: boolean }[];
};

const SECTION = "text-[11px] uppercase tracking-[0.14em] text-ash";

export default function FilmPanel({
  film,
  unreleased = false,
  entries,
  inWatchlist,
  watchlistSource,
  lists,
}: Props) {
  const confirm = useConfirm();
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [logOpen, setLogOpen] = useState(false);
  const [editing, setEditing] = useState<Viewing | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [wl, setWl] = useState(inWatchlist);
  const [wlSource, setWlSource] = useState(watchlistSource ?? "");
  const [wlAskSource, setWlAskSource] = useState(false);

  // membership is server state; mirror it so a chip lands the moment you tick it
  const [listState, setListState] = useState(lists);
  const [prevLists, setPrevLists] = useState(lists);
  if (lists !== prevLists) {
    setPrevLists(lists);
    setListState(lists);
  }

  // A second mutation landing before the first returns would duplicate a row,
  // and `busy` re-renders too late to stop it, so lock on a ref.
  const inFlight = useRef(false);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addOpen) return;
    function onDown(e: MouseEvent) {
      if (!addRef.current?.contains(e.target as Node)) setAddOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAddOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [addOpen]);

  async function request(fn: () => Promise<Response>): Promise<Response | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(await errorFrom(res, "That didn't save. Try again."));
        return null;
      }
      return res;
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const isRewatch = entries.length > 0;

  async function logViewing(payload: LogPayload) {
    const res = await request(() =>
      fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId: film.id, ...payload, rewatch: isRewatch }),
      }),
    );
    if (!res) return;
    await readJson<{ entry: { id: string } }>(res);

    // watching it settles the watchlist, since it's no longer something to get to
    let movedFromWatchlist = false;
    if (wl) {
      await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId: film.id }),
      }).catch(() => {});
      setWl(false);
      setWlAskSource(false);
      movedFromWatchlist = true;
    }

    setLogOpen(false);
    toast({
      message: (
        <>
          {movedFromWatchlist ? "Moved to diary" : "Logged"} <b>{film.title}</b>
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
    router.refresh();
  }

  async function saveEdit(payload: LogPayload) {
    if (!editing) return;
    const res = await request(() =>
      fetch(`/api/entries/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
    if (!res) return;
    setEditing(null);
    toast({ message: "Viewing updated" });
    router.refresh();
  }

  async function deleteViewing(v: Viewing) {
    const ok = await confirm({
      title: "Delete this viewing?",
      body: "The rating and anything written with it go too. This can't be undone.",
      action: "Delete",
    });
    if (!ok) return;
    const res = await request(() => fetch(`/api/entries/${v.id}`, { method: "DELETE" }));
    if (!res) return;
    toast({ message: "Viewing deleted" });
    router.refresh();
  }

  async function toggleList(listId: string, has: boolean) {
    const res = await request(() =>
      fetch(`/api/lists/${listId}/items`, {
        method: has ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId: film.id }),
      }),
    );
    if (!res) return;
    setListState((ls) => ls.map((l) => (l.id === listId ? { ...l, hasFilm: !has } : l)));
    router.refresh();
  }

  async function toggleWatchlist() {
    const res = await request(() =>
      fetch("/api/watchlist", {
        method: wl ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wl ? { filmId: film.id } : { filmId: film.id, source: null }),
      }),
    );
    if (!res) return;
    const next = !wl;
    setWl(next);
    setWlAskSource(next);
    if (!next) setWlSource("");
    toast({ message: next ? "Added to watchlist" : "Removed from watchlist" });
    router.refresh();
  }

  async function saveWlSource() {
    const res = await request(() =>
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId: film.id, source: wlSource || null }),
      }),
    );
    if (!res) return;
    setWlAskSource(false);
    toast({ message: "Saved where it came from" });
    router.refresh();
  }

  const inLists = listState.filter((l) => l.hasFilm);

  return (
    <div>
      {/* actions read as one quiet toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Not disabled-and-silent: a dead button invites clicking it and says
            nothing. The reason replaces the control, and the watchlist stays
            available because wanting to see it is the whole point. */}
        {unreleased ? (
          <p className="rounded-card border border-seam bg-tray px-4 py-2.5 text-sm text-ash">
            Not out yet. It can be logged from its release date.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="display rounded-card bg-paper px-4 py-2.5 text-sm font-medium text-carbon hover:bg-white"
          >
            {isRewatch ? "Log a rewatch" : "Log a viewing"}
          </button>
        )}
        <button
          type="button"
          onClick={toggleWatchlist}
          disabled={busy}
          aria-pressed={wl}
          className={`rounded-card border px-3.5 py-2.5 text-sm transition-colors disabled:opacity-50 ${
            wl
              ? "border-seam bg-tray text-paper hover:bg-tray-2"
              : "border-seam text-ash hover:text-paper"
          }`}
        >
          {wl ? "✓ On watchlist" : "Add to watchlist"}
        </button>
        {listState.length > 0 && (
          <div ref={addRef} className="relative">
            <button
              type="button"
              onClick={() => setAddOpen((o) => !o)}
              aria-expanded={addOpen}
              className="rounded-card border border-beam-edge bg-[#161d24] px-3.5 py-2.5 text-sm text-beam hover:bg-[#1a232c]"
            >
              Add to list {addOpen ? "↑" : "↓"}
            </button>
            {addOpen && (
              <div className="absolute left-0 top-full z-20 mt-2 w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-seam bg-lift shadow-[0_16px_44px_rgba(0,0,0,.5)]">
                <div className={`${SECTION} border-b border-seam px-3.5 py-2.5`}>Add to a list</div>
                <ul className="max-h-64 overflow-y-auto py-1">
                  {listState.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => toggleList(l.id, l.hasFilm)}
                        disabled={busy}
                        aria-pressed={l.hasFilm}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-tray disabled:opacity-50"
                      >
                        <span
                          aria-hidden
                          className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border text-[11px] ${
                            l.hasFilm
                              ? "border-paper bg-paper text-carbon"
                              : "border-seam text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className={l.hasFilm ? "text-paper" : "text-ash"}>{l.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-seam px-3.5 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => setAddOpen(false)}
                    className="text-[13px] text-beam hover:underline"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* lists this film is in, as removable chips */}
      {inLists.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {inLists.map((l) => (
            <li key={l.id}>
              <span className="flex items-center gap-1.5 rounded-full border border-seam bg-tray py-1 pl-3 pr-1.5 text-xs">
                <Link href={`/lists/${l.id}`} className="text-paper hover:underline">
                  {l.title}
                </Link>
                <button
                  type="button"
                  onClick={() => toggleList(l.id, true)}
                  disabled={busy}
                  aria-label={`Remove from ${l.title}`}
                  className="px-0.5 leading-none text-ash hover:text-warn disabled:opacity-50"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {wl && wlAskSource && (
        <div className="mt-3 rounded-card border border-seam bg-tray p-3">
          <label htmlFor="wl-source" className="mb-1.5 block text-xs text-ash">
            Where did this come from? (optional)
          </label>
          <div className="flex gap-2">
            <input
              id="wl-source"
              value={wlSource}
              onChange={(e) => setWlSource(e.target.value)}
              placeholder="Who recommended it, or where you saw it"
              className="min-w-0 flex-1 rounded-card border border-seam bg-carbon px-3 py-1.5 text-sm placeholder:text-dim focus:border-beam focus:outline-none"
            />
            <button
              type="button"
              onClick={saveWlSource}
              disabled={busy}
              className="shrink-0 rounded-card border border-seam px-3 py-1.5 text-sm text-paper hover:bg-tray-2 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <section className="mt-6">
          <h2 className={`${SECTION} mb-2.5`}>Viewings · {entries.length}</h2>
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <ViewingCard
                key={e.id}
                viewing={e}
                busy={busy}
                onEdit={() => setEditing(e)}
                onDelete={() => deleteViewing(e)}
              />
            ))}
          </ul>
        </section>
      )}

      {error && <p className="mt-3 text-sm text-warn">{error}</p>}

      {/* thumb-reachable on mobile; the toolbar above covers desktop */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-seam bg-[rgba(20,20,23,.96)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden">
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="display flex-1 rounded-lg bg-paper py-2.5 text-sm font-medium text-carbon"
        >
          {isRewatch ? "Log a rewatch" : "Log a viewing"}
        </button>
        {listState.length > 0 && (
          <button
            type="button"
            onClick={() => setAddOpen((o) => !o)}
            aria-label="Add to a list"
            className="flex size-[42px] items-center justify-center rounded-lg border border-seam bg-tray text-lg text-ash"
          >
            ＋
          </button>
        )}
      </div>
      {/* the fixed bar would otherwise cover the end of the page */}
      <div aria-hidden className="h-20 sm:hidden" />

      {logOpen && (
        <LogSheet
          open
          onClose={() => setLogOpen(false)}
          film={film}
          isRewatch={isRewatch}
          busy={busy}
          error={error}
          onSubmit={logViewing}
        />
      )}
      {editing && (
        <LogSheet
          open
          mode="edit"
          onClose={() => setEditing(null)}
          film={film}
          isRewatch={editing.rewatch}
          busy={busy}
          error={error}
          onSubmit={saveEdit}
          initial={{
            watchedOn: editing.watchedOn,
            rating: editing.rating,
            review: editing.review,
            spoiler: editing.spoiler,
            private: editing.private,
          }}
        />
      )}
    </div>
  );
}
