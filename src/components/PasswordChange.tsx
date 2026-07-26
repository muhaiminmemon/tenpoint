"use client";

import { useState } from "react";
import { errorFrom } from "@/lib/http";

const FIELD =
  "w-full rounded-card border border-seam bg-tray px-3 py-2.5 text-sm text-paper focus:border-beam focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] text-ash";

export default function PasswordChange() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (newPassword !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        setError(await errorFrom(res, "Couldn't change your password."));
        return;
      }
      setDone(true);
      setOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 border-t border-seam pt-6">
      <h2 className="text-sm uppercase tracking-wide text-ash">Password</h2>
      {done && !open && (
        <p className="mt-2 text-sm text-ash">
          Password changed. Any other device that was signed in has been signed out.
        </p>
      )}
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
          className="mt-3 rounded-card border border-seam px-4 py-1.5 text-sm text-paper hover:bg-tray"
        >
          Change password
        </button>
      ) : (
        <form onSubmit={submit} className="mt-3 flex max-w-sm flex-col gap-4">
          <div>
            <label htmlFor="current-password" className={LABEL}>
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="new-password" className={LABEL}>
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className={LABEL}>
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className={FIELD}
            />
          </div>
          {error && <p className="text-sm text-warn">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-card bg-paper px-4 py-1.5 text-sm font-medium text-carbon hover:bg-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save password"}
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
