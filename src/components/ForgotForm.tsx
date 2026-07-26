"use client";

import { useState } from "react";
import Link from "next/link";
import { errorFrom } from "@/lib/http";

const FIELD =
  "w-full rounded-card border border-seam bg-tray px-3 py-2.5 text-sm text-paper focus:border-beam focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] text-ash";

export default function ForgotForm() {
  const [identity, setIdentity] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity }),
      });
      if (!res.ok) {
        setError(await errorFrom(res, "Couldn't send that. Try again."));
        return;
      }
      setSent(true);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <>
        <h1 className="display text-2xl text-paper">Check your email</h1>
        {/* Deliberately not "we sent it to you": confirming the address exists
            would make this page an account-enumeration tool. */}
        <p className="mt-3 text-sm text-ash">
          If an account matches that, a reset link is on its way. It&apos;s good for one hour.
        </p>
        <p className="mt-5 text-[13px] text-ash">
          <Link href="/login" className="text-paper underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="display text-2xl text-paper">Reset your password</h1>
      <p className="mt-2 text-sm text-ash">
        Tell us your username or email and we&apos;ll send a link to set a new password.
      </p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
        <div>
          <label htmlFor="identity" className={LABEL}>
            Username or email
          </label>
          <input
            id="identity"
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            autoComplete="username"
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
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-4 text-[13px] text-ash">
        Remembered it?{" "}
        <Link href="/login" className="text-paper underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </>
  );
}
