"use client";

/**
 * THESIS: a list you made and a list you were added to are different objects,
 * and the index that hides which is which makes you open one to find out. This
 * refuses the category default the page shipped with — one undifferentiated
 * grid of covers, sorted by the day each was created.
 * OWN-WORLD: the app's projection-room graphite, unchanged. Covers carry the
 * colour, chrome is hairline seams and tracked micro-caps, and role is said in
 * words rather than coded in a hue.
 * STORY: the reader sees what is theirs, then what they share and with whom,
 * finds one by name, and acts on it without opening it.
 * FIRST VIEWPORT: create and search on one line, then YOURS, then SHARED WITH
 * YOU, each card a cover beside its own description and count.
 * FORM: split by ownership, candidate 3 of the grounded list, seed key 94b342f8.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 * finish review, the verdict, and DESIGN.md.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DotsThree, MagnifyingGlass, Plus } from "@phosphor-icons/react/ssr";
import ListCover from "./ListCover";
import Avatar from "./Avatar";
import { useConfirm } from "./Confirm";
import { useToast } from "./Toast";
import { errorFrom, readJson } from "@/lib/http";
import { useUrlState, useUrlText } from "@/lib/useUrlState";

export type ListCard = {
  id: string;
  title: string;
  description: string | null;
  count: number;
  /** how many of those are seasons or whole series rather than films */
  screenCount: number;
  role: "owner" | "editor" | "viewer";
  mine: boolean;
  /** the auto-made list a friendship owns, from "What should we watch?" */
  pair: boolean;
  createdAt: string;
  editedAt: string;
  posters: (string | null)[];
  others: { userId: string; name: string; avatarUrl: string | null }[];
};

type Sort = "edited" | "created" | "title" | "size";
const SORT_KEYS = ["edited", "created", "title", "size"] as const;

const SORTS: { value: Sort; label: string }[] = [
  { value: "edited", label: "Recently edited" },
  { value: "created", label: "Newest" },
  { value: "title", label: "A–Z" },
  { value: "size", label: "Biggest" },
];

/**
 * What the list actually holds, counted at the grain the product uses.
 *
 * "14 films" was printed over any mixture, and a list of four films and two
 * seasons is not six films. Naming the parts only when there are two kinds
 * keeps the common case short.
 */
function holdsLabel(count: number, screenCount: number): string {
  if (count === 0) return "Empty";
  const films = count - screenCount;
  if (screenCount === 0) return `${films} ${films === 1 ? "film" : "films"}`;
  if (films === 0) return `${screenCount} on television`;
  return `${count} titles`;
}

function agoLabel(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function ListsIndex({
  cards,
  viewerId,
}: {
  cards: ListCard[];
  /** needed to leave a list: the members endpoint takes the id being removed */
  viewerId: string;
}) {
  const [rows, setRows] = useState(cards);
  const [prev, setPrev] = useState(cards);
  if (cards !== prev) {
    setPrev(cards);
    setRows(cards);
  }

  // In the URL for the same reason the watchlist's are: opening a list
  // unmounts this, and a search held here would not survive coming back.
  const [query, setQuery] = useUrlText("q");
  const [sort, setSort] = useUrlState<Sort>("sort", "edited", SORT_KEYS);
  /**
   * Held here rather than inside the form.
   *
   * The button belongs in the header row and the form does not: the row is
   * bottom-aligned, so a panel several times the height of the heading beside
   * it grew upward and left the page, which is exactly what it looked like.
   * The trigger stays in the corner, the panel opens in the content flow.
   */
  const [creating, setCreating] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter(
      (l) =>
        !q ||
        l.title.toLowerCase().includes(q) ||
        (l.description?.toLowerCase().includes(q) ?? false),
    );
    return [...list].sort((a, b) => {
      switch (sort) {
        case "edited":
          return b.editedAt.localeCompare(a.editedAt);
        case "created":
          return b.createdAt.localeCompare(a.createdAt);
        case "title":
          return a.title.localeCompare(b.title);
        case "size":
          return b.count - a.count;
      }
    });
  }, [rows, query, sort]);

  const mine = shown.filter((l) => l.mine);
  const shared = shown.filter((l) => !l.mine);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl text-paper">Lists</h1>
          <p className="mt-1 text-sm text-ash">
            {rows.length > 0 ? (
              <>
                <span className="num">{rows.length}</span>{" "}
                {rows.length === 1 ? "list" : "lists"}, yours and the ones you share.
              </>
            ) : (
              <>Shelves you build on purpose, alone or with somebody.</>
            )}
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-card bg-paper px-3.5 py-1.5 text-sm font-medium text-carbon transition-colors hover:bg-white"
          >
            <Plus aria-hidden size={14} weight="bold" />
            New list
          </button>
        )}
      </div>

      {creating && <NewListPanel onClose={() => setCreating(false)} />}

      {rows.length > 3 && (
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
              placeholder="Search your lists"
              aria-label="Search your lists"
              className="w-full rounded-card border border-seam bg-tray py-1.5 pl-8 pr-2.5 text-sm text-paper placeholder:text-dim focus:border-edge"
            />
          </label>
          <label className="flex items-center gap-1.5 rounded-card border border-seam bg-tray px-2.5 py-1.5 text-sm">
            <span className="sr-only">Sort lists by</span>
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
        </div>
      )}

      {rows.length === 0 ? (
        <div className="mt-8 max-w-[52ch]">
          <p className="display text-[19px] text-paper">No lists yet.</p>
          <p className="mt-2 text-sm leading-relaxed text-ash">
            A list is any shelf worth keeping apart: a director you are working through, the ones
            you keep meaning to rewatch, a night you are planning with somebody. Saving a pick
            from <span className="text-paper">What should we watch?</span> starts a shared one for
            the two of you automatically.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-6">
          <p className="text-sm text-paper">No list matches that.</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-1.5 text-sm text-ash underline underline-offset-4 hover:text-paper"
          >
            Clear the search
          </button>
        </div>
      ) : (
        <>
          <Section title="Yours" count={mine.length} cards={mine} setRows={setRows} viewerId={viewerId} />
          <Section
            title="Shared with you"
            count={shared.length}
            cards={shared}
            setRows={setRows}
            viewerId={viewerId}
          />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  cards,
  setRows,
  viewerId,
}: {
  title: string;
  count: number;
  cards: ListCard[];
  setRows: React.Dispatch<React.SetStateAction<ListCard[]>>;
  viewerId: string;
}) {
  if (count === 0) return null;
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2.5">
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-ash">{title}</h2>
        <span className="num text-[11px] text-dim">{count}</span>
        <span aria-hidden className="h-px flex-1 bg-seam" />
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {cards.map((l) => (
          <Card key={l.id} list={l} setRows={setRows} viewerId={viewerId} />
        ))}
      </ul>
    </section>
  );
}

function Card({
  list,
  setRows,
  viewerId,
}: {
  list: ListCard;
  setRows: React.Dispatch<React.SetStateAction<ListCard[]>>;
  viewerId: string;
}) {
  return (
    <li className="group relative rounded-card border border-seam bg-lift transition-colors hover:border-edge">
      <Link href={`/lists/${list.id}`} className="flex gap-3 p-3">
        <ListCover posterPaths={list.posters} size="lg" className="w-20 sm:w-24" />
        <div className="min-w-0 flex-1">
          {/* padding-right leaves the menu button its corner */}
          <div className="flex min-w-0 items-baseline gap-2 pr-7">
            <span className="display truncate text-[15px] leading-tight text-paper">
              {list.title}
            </span>
            {list.pair && (
              <span className="shrink-0 rounded-full border border-[#4a3a24] bg-[#241d16] px-1.5 py-px text-[10px] uppercase tracking-[.08em] text-gold">
                Pair
              </span>
            )}
          </div>

          {list.description ? (
            <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-card-3">
              {list.description}
            </p>
          ) : (
            <p className="mt-1 text-[12px] leading-snug text-dim">No description</p>
          )}

          <p className="num mt-1.5 text-[11px] text-ash">
            {holdsLabel(list.count, list.screenCount)}
            {list.count > 0 && <> · edited {agoLabel(list.editedAt)}</>}
          </p>

          {(list.others.length > 0 || !list.mine) && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="flex">
                {list.others.slice(0, 3).map((m) => (
                  <span
                    key={m.userId}
                    title={m.name}
                    className="-ml-1 rounded-full ring-2 ring-lift first:ml-0"
                  >
                    <Avatar avatarUrl={m.avatarUrl} name={m.name} size={16} />
                  </span>
                ))}
              </span>
              <span className="truncate text-[11px] text-dim">
                {list.others.length > 3 && `+${list.others.length - 3} · `}
                {/* Said in words rather than a coloured chip: "viewer" is a
                    permission, and a reader should not have to learn a legend
                    to find out they cannot add anything. */}
                {list.mine
                  ? list.others.length === 1
                    ? `with ${list.others[0].name}`
                    : `with ${list.others.length} others`
                  : list.role === "viewer"
                    ? "you can read this"
                    : "you can edit this"}
              </span>
            </div>
          )}
        </div>
      </Link>

      <Menu list={list} setRows={setRows} viewerId={viewerId} />
    </li>
  );
}

function Menu({
  list,
  setRows,
  viewerId,
}: {
  list: ListCard;
  setRows: React.Dispatch<React.SetStateAction<ListCard[]>>;
  viewerId: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function duplicate() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/lists/${list.id}/duplicate`, { method: "POST" });
      if (!res.ok) {
        toast({ message: await errorFrom(res, "Couldn't copy that list."), tone: "warn" });
        return;
      }
      const data = await readJson<{ list: { id: string }; copied: number }>(res);
      toast({
        message: `Copied ${list.title}${data.copied ? ` · ${data.copied} titles` : ""}`,
        action: data.list?.id ? { label: "Open the copy", href: `/lists/${data.list.id}` } : undefined,
      });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    const ok = await confirm({
      title: `Leave ${list.title}?`,
      body: "It stays on the owner's shelf and anything you added stays in it. You will need another invite to get back in.",
      action: "Leave",
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/lists/${list.id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: viewerId }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      toast({ message: "Couldn't leave that list.", tone: "warn" });
      return;
    }
    setRows((all) => all.filter((l) => l.id !== list.id));
    toast({ message: `Left ${list.title}` });
    router.refresh();
  }

  async function destroy() {
    const ok = await confirm({
      title: `Delete ${list.title}?`,
      body:
        list.count > 0
          ? `The list goes, and the ${list.count} ${list.count === 1 ? "title" : "titles"} on it stop being grouped. Nothing is removed from your diary or ratings. Anyone you shared it with loses it too. This can't be undone.`
          : "This can't be undone.",
      action: "Delete",
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/lists/${list.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      toast({ message: "Couldn't delete that list.", tone: "warn" });
      return;
    }
    setRows((all) => all.filter((l) => l.id !== list.id));
    toast({ message: `Deleted ${list.title}` });
    router.refresh();
  }

  return (
    <div ref={ref} className="absolute right-1.5 top-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${list.title}`}
        className="flex size-7 items-center justify-center rounded-[4px] text-dim transition-colors hover:bg-tray hover:text-paper"
      >
        <DotsThree aria-hidden size={18} weight="bold" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-card border border-edge bg-tray py-1 shadow-[0_12px_32px_rgba(0,0,0,.5)]"
        >
          <MenuItem onClick={duplicate} disabled={busy}>
            Duplicate
          </MenuItem>
          {list.mine ? (
            <MenuItem onClick={destroy} disabled={busy} tone="warn">
              Delete
            </MenuItem>
          ) : (
            <MenuItem onClick={leave} disabled={busy} tone="warn">
              Leave
            </MenuItem>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  disabled,
  tone,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone?: "warn";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`block w-full px-3 py-1.5 text-left text-sm transition-colors disabled:opacity-50 ${
        tone === "warn" ? "text-ash hover:bg-tray-2 hover:text-warn" : "text-paper hover:bg-tray-2"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Title and description in one step, and you stay here.
 *
 * The old form took a title, created the list, and pushed you onto its page,
 * so building three shelves in a row meant three trips back. It also never
 * offered the description the API has always accepted, which is why almost no
 * list has one.
 */
function NewListPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description.trim() || null }),
      });
      if (!res.ok) {
        setError(await errorFrom(res, "Couldn't create that list."));
        return;
      }
      const data = await readJson<{ list: { id: string } }>(res);
      toast({
        message: `Created ${title}`,
        action: data.list?.id ? { label: "Open it", href: `/lists/${data.list.id}` } : undefined,
      });
      setTitle("");
      setDescription("");
      onClose();
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={create}
      className="mt-5 w-full max-w-md rounded-card border border-edge bg-lift p-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="List title"
        aria-label="List title"
        autoFocus
        required
        maxLength={120}
        className="w-full rounded-card border border-seam bg-tray px-3 py-1.5 text-sm text-paper placeholder:text-dim focus:border-edge focus:outline-none"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What is it for? (optional)"
        aria-label="List description"
        rows={2}
        maxLength={2000}
        className="mt-2 w-full resize-none rounded-card border border-seam bg-tray px-3 py-1.5 text-sm text-paper placeholder:text-dim focus:border-edge focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-card bg-paper px-3.5 py-1.5 text-sm font-medium text-carbon transition-colors hover:bg-white disabled:opacity-50"
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            onClose();
          }}
          className="text-sm text-ash transition-colors hover:text-paper"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-warn">{error}</p>}
    </form>
  );
}
