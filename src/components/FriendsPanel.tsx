"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorFrom, readJson } from "@/lib/http";
import Avatar from "./Avatar";

type Friend = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  rated: number;
};
type IncomingRequest = {
  requestId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};
type OutgoingRequest = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};
type PersonResult = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type Props = {
  me: string;
  friends: Friend[];
  incoming: IncomingRequest[];
  outgoing: OutgoingRequest[];
};

export default function FriendsPanel({ me, friends, incoming, outgoing }: Props) {
  const router = useRouter();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** One mutation at a time, and never silently. */
  async function act(fn: () => Promise<Response>, fallback: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(await errorFrom(res, fallback));
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function getInvite() {
    setError(null);
    const res = await fetch("/api/friends/invite", { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      setError(res ? await errorFrom(res, "Couldn't make an invite link.") : "Couldn't reach the server.");
      return;
    }
    const data = await readJson<{ url: string }>(res);
    if (data.url) setInviteUrl(data.url);
  }

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Select the link and copy it manually.");
    }
  }

  const respond = (requestId: string, action: "accept" | "decline") =>
    act(
      () =>
        fetch("/api/friends/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId, action }),
        }),
      action === "accept" ? "Couldn't accept that request." : "Couldn't decline that request.",
    );

  const cancel = (userId: string) =>
    act(
      () =>
        fetch("/api/friends/request", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }),
      "Couldn't cancel that request.",
    );

  async function remove(friend: Friend) {
    const label = friend.displayName ?? friend.username;
    if (!window.confirm(`Remove ${label} as a friend? You can send a new request later.`)) return;
    await act(
      () =>
        fetch("/api/friends", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: friend.id }),
        }),
      "Couldn't remove that friend.",
    );
  }

  return (
    <div>
      <PeopleSearch onChanged={() => router.refresh()} />

      {error && <p className="mt-4 text-sm text-warn">{error}</p>}

      {incoming.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wide text-ash">Friend requests</h2>
          <ul className="mt-2 divide-y divide-seam border-y border-seam">
            {incoming.map((r) => (
              <li key={r.requestId} className="flex items-center gap-3 py-3">
                <Avatar avatarUrl={r.avatarUrl} name={r.displayName ?? r.username} size={36} />
                <span className="min-w-0 flex-1">
                  <Link href={`/${r.username}`} className="text-paper hover:underline">
                    {r.displayName ?? r.username}
                  </Link>
                  <span className="block text-xs text-ash">@{r.username}</span>
                </span>
                <button
                  type="button"
                  onClick={() => respond(r.requestId, "accept")}
                  disabled={busy}
                  className="rounded-card bg-paper px-3 py-1.5 text-sm font-medium text-carbon hover:bg-white disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => respond(r.requestId, "decline")}
                  disabled={busy}
                  className="text-sm text-ash hover:text-warn disabled:opacity-50"
                >
                  Decline
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wide text-ash">Sent</h2>
          <ul className="mt-2 space-y-1.5">
            {outgoing.map((r) => (
              <li key={r.userId} className="flex items-center gap-3 text-sm">
                <Avatar avatarUrl={r.avatarUrl} name={r.displayName ?? r.username} size={24} />
                <Link href={`/${r.username}`} className="text-paper hover:underline">
                  {r.displayName ?? r.username}
                </Link>
                <span className="text-xs text-ash">waiting</span>
                <button
                  type="button"
                  onClick={() => cancel(r.userId)}
                  disabled={busy}
                  className="text-xs text-ash hover:text-warn disabled:opacity-50"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-ash">Friends</h2>
        {friends.length === 0 ? (
          <p className="mt-2 text-ash">
            No friends yet. Search for someone above, or share your invite link below.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-seam border-y border-seam">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-3">
                <Avatar avatarUrl={f.avatarUrl} name={f.displayName ?? f.username} size={36} />
                <span className="min-w-0 flex-1">
                  <Link href={`/${f.username}`} className="text-paper hover:underline">
                    {f.displayName ?? f.username}
                  </Link>
                  <span className="num block text-xs text-ash">
                    @{f.username} · {f.rated} rated
                  </span>
                </span>
                <Link
                  href={`/watch/${me}/${f.username}`}
                  className="rounded-card border border-seam px-3 py-1.5 text-sm text-paper hover:bg-tray"
                >
                  What should we watch?
                </Link>
                <button
                  type="button"
                  onClick={() => remove(f)}
                  disabled={busy}
                  className="text-sm text-ash hover:text-warn disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 rounded-card border border-seam bg-tray p-4">
        <h2 className="text-paper">Or share an invite link</h2>
        <p className="mt-1 text-sm text-ash">
          For friends who aren&apos;t here yet. The link takes them through signup straight to
          being friends with you.
        </p>
        {inviteUrl ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              readOnly
              value={inviteUrl}
              aria-label="Your invite link"
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-card border border-seam bg-carbon px-3 py-1.5 text-sm text-ash"
            />
            <button
              type="button"
              onClick={copy}
              className="rounded-card bg-paper px-3 py-1.5 text-sm font-medium text-carbon hover:bg-white"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={getInvite}
            className="mt-3 rounded-card border border-seam px-4 py-1.5 text-sm text-paper hover:bg-tray-2"
          >
            Get your invite link
          </button>
        )}
      </section>
    </div>
  );
}

function PeopleSearch({ onChanged }: { onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PersonResult[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);
  // Without these the search could only ever render results. A query that
  // matched nothing and a request that failed both drew the same blank space,
  // which is indistinguishable from the field being broken.
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const query = q.trim();
    // abort so a stale response can't replace results for a newer query
    const ac = new AbortController();
    const t = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        setSearching(false);
        setFailed(false);
        return;
      }
      setSearching(true);
      setFailed(false);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
          signal: ac.signal,
        });
        const data = await readJson<{ results: PersonResult[] }>(res);
        if (ac.signal.aborted) return;
        setResults(data.results ?? []);
      } catch {
        // An aborted request is the next keystroke arriving, not a failure.
        if (!ac.signal.aborted) {
          setResults([]);
          setFailed(true);
        }
      } finally {
        if (!ac.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q]);

  async function add(userId: string) {
    setAddError(null);
    const res = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);
    if (!res?.ok) {
      setAddError(res ? await errorFrom(res, "Couldn't send that request.") : "Couldn't reach the server.");
      return;
    }
    setSent((s) => new Set(s).add(userId));
    onChanged();
  }

  return (
    <section>
      <label htmlFor="people-search" className="mb-1 block text-sm text-ash">
        Find people
      </label>
      {/* A phone keyboard treats a bare text field as prose: it capitalises the
          first letter and autocorrects as you go, so "hamza" is offered as
          "Hamza" and can be rewritten into a real word outright. Case is
          handled server-side, but a substituted word is a different query, and
          it only ever happens on touch — which is why this read as a
          phone-only fault. */}
      <input
        id="people-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Username or name"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className="w-full rounded-card border border-seam bg-tray px-3 py-2 text-base placeholder:text-ash focus:border-beam focus:outline-none sm:text-sm"
      />
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-seam rounded-card border border-seam bg-tray">
          {results.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <Avatar avatarUrl={p.avatarUrl} name={p.displayName ?? p.username} size={32} />
              <span className="min-w-0 flex-1">
                <Link href={`/${p.username}`} className="text-sm text-paper hover:underline">
                  {p.displayName ?? p.username}
                </Link>
                <span className="block text-xs text-ash">@{p.username}</span>
              </span>
              <button
                type="button"
                onClick={() => add(p.id)}
                disabled={sent.has(p.id)}
                className="rounded-card border border-seam px-3 py-1 text-sm text-paper hover:bg-tray-2 disabled:opacity-60"
              >
                {sent.has(p.id) ? "Request sent" : "Add friend"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !searching && results.length === 0 && (
        <p className="mt-2 text-sm text-ash">
          {failed ? (
            "Couldn't reach the server. Check your connection and try again."
          ) : (
            <>
              No one found. People show up here once they&apos;ve confirmed their email, so a
              friend who just signed up may need to check their inbox first.
            </>
          )}
        </p>
      )}
      {addError && <p className="mt-2 text-sm text-warn">{addError}</p>}
    </section>
  );
}
