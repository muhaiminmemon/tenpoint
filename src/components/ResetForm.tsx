"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorFrom } from "@/lib/http";

const FIELD =
  "w-full rounded-card border border-seam bg-tray px-3 py-2.5 text-sm text-paper focus:border-beam focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] text-ash";

export default function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        setError(await errorFrom(res, "Couldn't reset your password."));
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <h1 className="display text-2xl text-paper">Password changed</h1>
        <p className="mt-3 text-sm text-ash">
          Every device that was signed in has been signed out, including this one. Sign in again
          with your new password.
        </p>
        <Link
          href="/login"
          className="display mt-5 inline-block rounded-card bg-paper px-5 py-2.5 text-[15px] font-medium text-carbon hover:bg-white"
        >
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="display text-2xl text-paper">Choose a new password</h1>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
        <div>
          <label htmlFor="password" className={LABEL}>
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className={FIELD}
          />
          <p className="mt-1.5 text-xs text-ash">At least 8 characters.</p>
        </div>
        <div>
          <label htmlFor="confirm" className={LABEL}>
            Confirm new password
          </label>
          <input
            id="confirm"
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
        <button
          type="submit"
          disabled={busy}
          className="display rounded-card bg-paper py-2.5 text-[15px] font-medium text-carbon hover:bg-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Set new password"}
        </button>
      </form>
    </>
  );
}
