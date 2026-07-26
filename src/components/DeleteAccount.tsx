"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { errorFrom } from "@/lib/http";

const FIELD =
  "w-full rounded-card border border-seam bg-tray px-3 py-2.5 text-sm text-paper focus:border-beam focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] text-ash";

export default function DeleteAccount({ username }: { username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmUsername, setConfirmUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmUsername }),
      });
      if (!res.ok) {
        setError(await errorFrom(res, "Couldn't delete your account."));
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 border-t border-seam pt-6">
      <h2 className="text-sm uppercase tracking-wide text-ash">Delete account</h2>
      <p className="mt-2 text-sm text-ash">
        Permanently removes your diary, ratings, reviews, watchlist, lists, and friendships. This
        cannot be undone, and the export above is the only copy you&apos;ll get, so take it first
        if you want one.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-card border border-warn/40 px-4 py-1.5 text-sm text-warn hover:bg-warn/10"
        >
          Delete my account
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 flex max-w-sm flex-col gap-4">
          <div>
            <label htmlFor="delete-username" className={LABEL}>
              Type <span className="text-paper">{username}</span> to confirm
            </label>
            <input
              id="delete-username"
              value={confirmUsername}
              onChange={(e) => setConfirmUsername(e.target.value)}
              autoComplete="off"
              required
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="delete-password" className={LABEL}>
              Your password
            </label>
            <input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className={FIELD}
            />
          </div>
          {error && <p className="text-sm text-warn">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || confirmUsername.trim().toLowerCase() !== username}
              className="rounded-card bg-warn px-4 py-1.5 text-sm font-medium text-carbon hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="text-sm text-ash hover:text-paper"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
