"use client";

import { useState } from "react";
import { errorFrom } from "@/lib/http";

/**
 * Shown to signed-in users who haven't confirmed their address. Deliberately a
 * nudge and not a wall: an unconfirmed account can do everything private, it
 * just isn't listed in user search.
 */
export default function VerifyBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify", { method: "PUT" });
      if (!res.ok) {
        setMessage(await errorFrom(res, "Couldn't send it. Try again in a minute."));
        setState("error");
        return;
      }
      setState("sent");
    } catch {
      setMessage("Couldn't reach the server.");
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-seam bg-tray">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[13px]">
        {state === "sent" ? (
          <span className="text-ash">
            Sent. Check <span className="text-paper">{email}</span> for the confirmation link.
          </span>
        ) : (
          <>
            <span className="text-ash">
              Confirm <span className="text-paper">{email}</span> so friends can find you by
              username.
            </span>
            <button
              type="button"
              onClick={resend}
              disabled={busy}
              className="text-paper underline underline-offset-2 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Resend the link"}
            </button>
          </>
        )}
        {state === "error" && message && <span className="text-warn">{message}</span>}
      </div>
    </div>
  );
}
