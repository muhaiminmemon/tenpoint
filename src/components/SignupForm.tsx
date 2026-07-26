"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { errorFrom, safeNextPath } from "@/lib/http";
import { APP_DOMAIN } from "@/lib/brand";

const FIELD =
  "w-full rounded-card border border-seam bg-tray px-3 py-2.5 text-sm text-paper focus:border-beam focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] text-ash";
const HELP = "mt-1.5 block text-xs text-ash";

export default function SignupForm() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}

function Form() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.toLowerCase(), email, password }),
      });
      if (!res.ok) {
        setError(await errorFrom(res, "Couldn't create your account. Try again."));
        return;
      }
      router.push(safeNextPath(next, "/import"));
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="display text-2xl text-paper">Create your account</h1>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
        <div>
          <label htmlFor="username" className={LABEL}>
            Username
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={2}
            maxLength={24}
            pattern="[a-zA-Z0-9][a-zA-Z0-9-]*"
            className={FIELD}
          />
          {/* the URL fills in as you type, so the choice is concrete */}
          <span className={HELP}>
            Your profile lives at {APP_DOMAIN}/
            <span className="text-paper">{username.toLowerCase() || "you"}</span>
          </span>
        </div>
        <div>
          <label htmlFor="email" className={LABEL}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
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
            autoComplete="new-password"
            required
            minLength={8}
            className={FIELD}
          />
          <span className={HELP}>At least 8 characters.</span>
        </div>
        {error && <p className="text-sm text-warn">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="display rounded-card bg-paper py-2.5 text-[15px] font-medium text-carbon hover:bg-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="text-[12px] leading-relaxed text-ash">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="text-paper underline underline-offset-2">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-paper underline underline-offset-2">
            privacy policy
          </Link>
          . We&apos;ll email you a link to confirm your address.
        </p>
      </form>
      <p className="mt-4 text-[13px] text-ash">
        Already have one?{" "}
        <Link href="/login" className="text-paper underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </>
  );
}
