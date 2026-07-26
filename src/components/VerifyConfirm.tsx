"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorFrom } from "@/lib/http";

/**
 * The emailed link lands here rather than confirming on load. Mail providers
 * and link scanners issue GETs on everything in a message, and a token
 * redeemed by a scanner is a token the user can never use.
 */
export default function VerifyConfirm({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setError(await errorFrom(res, "Couldn't confirm that link."));
        return;
      }
      setState("done");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "done") {
    return (
      <>
        <h1 className="display text-2xl text-paper">Email confirmed</h1>
        <p className="mt-3 text-sm text-ash">
          That&apos;s everything. Your account is fully set up and people can find you by username.
        </p>
        <Link
          href="/library"
          className="display mt-5 inline-block rounded-card bg-paper px-5 py-2.5 text-[15px] font-medium text-carbon hover:bg-white"
        >
          Go to your library
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="display text-2xl text-paper">Confirm your email</h1>
      <p className="mt-3 text-sm text-ash">
        One tap and your address is verified.
      </p>
      {error && <p className="mt-4 text-sm text-warn">{error}</p>}
      <button
        type="button"
        onClick={confirm}
        disabled={busy}
        className="display mt-5 rounded-card bg-paper px-5 py-2.5 text-[15px] font-medium text-carbon hover:bg-white disabled:opacity-50"
      >
        {busy ? "Confirming…" : "Confirm my email"}
      </button>
    </>
  );
}
