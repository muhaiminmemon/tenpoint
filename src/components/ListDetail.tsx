"use client";

import { useState } from "react";
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { posterUrl } from "@/lib/tmdb-urls";
import { errorFrom } from "@/lib/http";
import type { ListRole } from "@/lib/lists";
import Avatar from "./Avatar";
import { useConfirm } from "./Confirm";
import ListCover from "./ListCover";
import BulkAddSheet, { type BulkAddFilm } from "./BulkAddSheet";

type Item = {
  filmId: string;
  title: string;
  year: number | null;
  slug: string;
  posterPath: string | null;
  director: string | null;
  note: string | null;
  addedBy: string | null;
  addedByName: string | null;
  addedByUsername: string | null;
  addedByAvatar: string | null;
};

type Member = {
  userId: string;
  role: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type Props = {
  list: { id: string; title: string; description: string | null };
  items: Item[];
  members: Member[];
  myRole: ListRole;
  myUserId: string;
  /** the viewer's library, for bulk-add */
  libraryFilms: BulkAddFilm[];
};

export default function ListDetail({
  list,
  items,
  members,
  myRole,
  myUserId,
  libraryFilms,
}: Props) {
  const confirm = useConfirm();
  const router = useRouter();
  const canEdit = myRole === "owner" || myRole === "editor";
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<"editor" | "viewer">("editor");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // local copy so a drag lands instantly; the server call follows
  const [rows, setRows] = useState(items);
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setRows(items);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.filmId === active.id);
    const to = rows.findIndex((r) => r.filmId === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(rows, from, to);
    setRows(next);
    await fetch(`/api/lists/${list.id}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedFilmIds: next.map((r) => r.filmId) }),
    }).catch(() => setRows(items));
  }

  const [bulkOpen, setBulkOpen] = useState(false);

  async function bulkAdd(filmIds: string[]) {
    const ok = await act(
      () =>
        fetch(`/api/lists/${list.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filmIds }),
        }),
      "Couldn't add those films.",
    );
    if (!ok) return;
    setBulkOpen(false);
    router.refresh();
  }

  async function saveNote(filmId: string, note: string) {
    setRows((list) =>
      list.map((r) => (r.filmId === filmId ? { ...r, note: note.trim() || null } : r)),
    );
    await fetch(`/api/lists/${list.id}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filmId, note: note.trim() || null }),
    }).catch(() => setRows(items));
    router.refresh();
  }

  /** One mutation at a time, and never silently. */
  async function act(fn: () => Promise<Response>, fallback: string) {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(await errorFrom(res, fallback));
        return false;
      }
      return true;
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveTitle() {
    const ok = await act(
      () =>
        fetch(`/api/lists/${list.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        }),
      "Couldn't rename this list.",
    );
    if (!ok) return;
    setRenaming(false);
    router.refresh();
  }

  async function removeItem(filmId: string) {
    const ok = await act(
      () =>
        fetch(`/api/lists/${list.id}/items`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filmId }),
        }),
      "Couldn't remove that film.",
    );
    if (ok) router.refresh();
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    const ok = await act(
      () =>
        fetch(`/api/lists/${list.id}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: memberName, role: memberRole }),
        }),
      "Couldn't add that person.",
    );
    if (!ok) return;
    setMemberName("");
    router.refresh();
  }

  async function removeMember(userId: string) {
    const leaving = userId === myUserId;
    if (leaving) {
      const ok = await confirm({
        title: `Leave "${list.title}"?`,
        body: "You'll lose access to it unless someone adds you back.",
        action: "Leave",
      });
      if (!ok) return;
    }
    const ok = await act(
      () =>
        fetch(`/api/lists/${list.id}/members`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }),
      leaving ? "Couldn't leave this list." : "Couldn't remove that member.",
    );
    if (!ok) return;
    if (leaving) router.push("/lists");
    router.refresh();
  }

  async function deleteList() {
    const confirmed = await confirm({
      title: `Delete "${list.title}" for everyone?`,
      body: `Its ${items.length} film${items.length === 1 ? "" : "s"} and all members go with it. This can't be undone.`,
      action: "Delete",
    });
    if (!confirmed) return;
    const ok = await act(
      () => fetch(`/api/lists/${list.id}`, { method: "DELETE" }),
      "Couldn't delete this list.",
    );
    if (!ok) return;
    router.push("/lists");
    router.refresh();
  }

  const editors = members.filter((m) => m.role === "owner" || m.role === "editor");

  return (
    <div className="max-w-2xl">
      {/* header: the cover, who's in, and how big the list is */}
      <div className="flex gap-5 rounded-xl border border-seam bg-carbon p-5">
        <ListCover posterPaths={rows.map((r) => r.posterPath)} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.12em] text-ash">
            {members.length > 1
              ? `Shared list · ${editors.length} can edit`
              : myRole === "owner"
                ? "Your list"
                : "Shared list"}
          </div>

          {renaming ? (
            <div className="mt-1.5 flex items-center gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-w-0 flex-1 rounded-card border border-seam bg-tray px-3 py-1.5 text-lg focus:border-beam focus:outline-none"
              />
              <button
                type="button"
                onClick={saveTitle}
                disabled={busy}
                className="text-sm text-ash hover:text-paper disabled:opacity-50"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h1 className="display mt-1 text-[26px] leading-tight text-paper">{list.title}</h1>
              {myRole === "owner" && (
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="text-xs text-ash hover:text-paper"
                >
                  Rename
                </button>
              )}
            </div>
          )}

          {list.description && (
            <p className="mt-1 max-w-md text-sm text-ash">{list.description}</p>
          )}

          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="flex">
              {members.slice(0, 5).map((m) => (
                <span
                  key={m.userId}
                  title={m.displayName ?? m.username}
                  className="-ml-1.5 rounded-full ring-2 ring-carbon first:ml-0"
                >
                  <Avatar
                    avatarUrl={m.avatarUrl}
                    name={m.displayName ?? m.username}
                    size={26}
                  />
                </span>
              ))}
            </div>
            <span className="num text-[13px] text-ash">
              {rows.length} {rows.length === 1 ? "title" : "titles"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-ash">
          {canEdit && rows.length > 1 ? "Drag a row to reorder" : ""}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="shrink-0 rounded-card border border-beam-edge bg-[#161d24] px-2.5 py-1.5 text-xs text-beam hover:bg-[#1a232c]"
          >
            ＋ Bulk-add from library
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-ash">
          Empty so far. Add films from their pages, bulk-add from your library, or save picks from
          “What should we watch?”
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={rows.map((r) => r.filmId)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {rows.map((i, index) => (
                <ListItemRow
                  key={i.filmId}
                  item={i}
                  rank={index + 1}
                  canEdit={canEdit}
                  busy={busy}
                  onRemove={() => removeItem(i.filmId)}
                  onSaveNote={(note) => saveNote(i.filmId, note)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {bulkOpen && (
        <BulkAddSheet
          open
          onClose={() => setBulkOpen(false)}
          films={libraryFilms.filter((f) => !rows.some((r) => r.filmId === f.filmId))}
          busy={busy}
          onAdd={bulkAdd}
        />
      )}

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-ash">Members</h2>
        <ul className="mt-2 space-y-1">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2 text-sm">
              <Avatar avatarUrl={m.avatarUrl} name={m.displayName ?? m.username} size={22} />
              <Link href={`/${m.username}`} className="text-paper hover:underline">
                {m.displayName ?? m.username}
              </Link>
              <span className="text-xs text-ash">{m.role}</span>
              {(myRole === "owner" && m.userId !== myUserId) ||
              (m.userId === myUserId && myRole !== "owner") ? (
                <button
                  type="button"
                  onClick={() => removeMember(m.userId)}
                  disabled={busy}
                  className="text-xs text-ash hover:text-warn disabled:opacity-50"
                >
                  {m.userId === myUserId ? "Leave" : "Remove"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {myRole === "owner" && (
          <form onSubmit={addMember} className="mt-3 flex gap-2">
            <input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Username"
              aria-label="Add member by username"
              className="min-w-0 flex-1 rounded-card border border-seam bg-tray px-3 py-1.5 text-sm placeholder:text-ash focus:border-beam focus:outline-none"
            />
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as "editor" | "viewer")}
              aria-label="Role"
              className="rounded-card border border-seam bg-tray px-2 py-1.5 text-sm"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={busy}
              className="rounded-card border border-seam px-3 py-1.5 text-sm text-paper hover:bg-tray disabled:opacity-50"
            >
              Add
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-warn">{error}</p>}
      </section>

      {myRole === "owner" && (
        <div className="mt-10 border-t border-seam pt-4">
          <button
            type="button"
            onClick={deleteList}
            disabled={busy}
            className="text-sm text-ash hover:text-warn disabled:opacity-50"
          >
            Delete this list
          </button>
        </div>
      )}
    </div>
  );
}

function ListItemRow({
  item,
  rank,
  canEdit,
  busy,
  onRemove,
  onSaveNote,
}: {
  item: Item;
  rank: number;
  canEdit: boolean;
  busy: boolean;
  onRemove: () => void;
  onSaveNote: (note: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.filmId,
    disabled: !canEdit,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.note ?? "");
  const poster = posterUrl(item.posterPath, "w154");
  const adder = item.addedByName ?? item.addedByUsername;

  function commit() {
    setEditing(false);
    if (draft.trim() !== (item.note ?? "").trim()) onSaveNote(draft);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-3 rounded-lg border border-seam bg-lift px-3 py-2.5 ${
        isDragging ? "relative z-10 bg-tray-2" : ""
      }`}
    >
      {canEdit && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${item.title}`}
          className="shrink-0 cursor-grab touch-none text-base text-[#3a3a44] hover:text-ash active:cursor-grabbing"
        >
          ⠿
        </button>
      )}

      <span className="num w-4 shrink-0 text-[13px] text-ash">{rank}</span>

      <Link href={`/film/${item.slug}`} className="shrink-0">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            loading="lazy"
            className="w-[34px] rounded-[4px] bg-tray object-cover"
            style={{ aspectRatio: "2/3" }}
          />
        ) : (
          <span
            aria-hidden
            className="block w-[34px] rounded-[4px] bg-tray"
            style={{ aspectRatio: "2/3" }}
          />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link
            href={`/film/${item.slug}`}
            className="display truncate text-sm text-paper hover:underline"
          >
            {item.title}
          </Link>
          <span className="num shrink-0 text-xs text-ash">{item.year ?? ""}</span>
        </div>

        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraft(item.note ?? "");
                setEditing(false);
              }
            }}
            placeholder="Why is this here?"
            aria-label={`Note for ${item.title}`}
            className="mt-1 w-full rounded-card border border-seam bg-carbon px-2 py-1 text-xs text-paper placeholder:text-dim focus:border-beam focus:outline-none"
          />
        ) : item.note ? (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setEditing(true)}
            className="mt-1 flex w-full items-center gap-1.5 text-left disabled:cursor-default"
          >
            {adder && (
              <Avatar avatarUrl={item.addedByAvatar} name={adder} size={16} />
            )}
            <span className="truncate text-xs italic text-ash">{item.note}</span>
          </button>
        ) : (
          canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-1 text-xs text-dim opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            >
              ＋ Add a note
            </button>
          )
        )}
      </div>

      {/* who put it here */}
      {adder && (
        <span className="shrink-0" title={`Added by ${adder}`}>
          <Avatar avatarUrl={item.addedByAvatar} name={adder} size={22} />
        </span>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Remove ${item.title} from list`}
          className="shrink-0 text-ash opacity-0 transition-opacity hover:text-warn focus-visible:opacity-100 disabled:opacity-50 group-hover:opacity-100"
        >
          ×
        </button>
      )}
    </li>
  );
}
