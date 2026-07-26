"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { errorFrom, safeNextPath } from "@/lib/http";

const FIELD =
  "w-full rounded-card border border-seam bg-tray px-3 py-2.5 text-sm text-paper focus:border-beam focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] text-ash";

export default function LoginForm() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}

function Form() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity, password }),
      });
      if (!res.ok) {
        setError(await errorFrom(res, "Couldn't sign you in. Try again."));
        return;
      }
      router.push(safeNextPath(next, "/library"));
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="display text-2xl text-paper">Sign in</h1>
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
        <div>
          <label htmlFor="password" className={LABEL}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-[13px] text-ash">
        New here?{" "}
        <Link href="/signup" className="text-paper underline underline-offset-2">
          Create an account
        </Link>
        {" · "}
        <Link href="/forgot" className="text-paper underline underline-offset-2">
          Forgot your password?
        </Link>
      </p>
    </>
  );
}
