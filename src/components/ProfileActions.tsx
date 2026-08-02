"use client";

import { useState } from "react";
import { useConfirm } from "./Confirm";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorFrom } from "@/lib/http";

export type Relationship =
  | { kind: "friends" }
  | { kind: "requested_out" }
  | { kind: "requested_in"; requestId: string }
  | { kind: "none" };

type Props = {
  profileId: string;
  profileUsername: string;
  viewerUsername: string;
  relationship: Relationship;
};

export default function ProfileActions({
  profileId,
  profileUsername,
  viewerUsername,
  relationship,
}: Props) {
  const confirm = useConfirm();
  const router = useRouter();
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.refresh();
      return true;
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const sendRequest = () =>
    act(
      () =>
        fetch("/api/friends/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: profileId }),
        }),
      "Couldn't send that friend request.",
    );

  const cancelRequest = () =>
    act(
      () =>
        fetch("/api/friends/request", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: profileId }),
        }),
      "Couldn't cancel that request.",
    );

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

  async function removeFriend() {
    const ok = await confirm({
      title: `Remove ${profileUsername} as a friend?`,
      body: "You can send a new request later.",
      action: "Remove",
    });
    if (!ok) return;
    await act(
      () =>
        fetch("/api/friends", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: profileId }),
        }),
      "Couldn't remove that friend.",
    );
  }

  async function block() {
    const ok = await confirm({
      title: `Block ${profileUsername}?`,
      body: "Neither of you will see the other's profile, and any friendship ends.",
      action: "Block",
    });
    if (!ok) return;
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profileId }),
      });
      if (!res.ok) {
        setError(await errorFrom(res, "Couldn't block that person."));
        return;
      }
      router.push("/library");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    const reason = window.prompt("What's wrong? A sentence is enough.");
    if (!reason) return;
    setError(null);
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectType: "user", subjectId: profileId, reason }),
    }).catch(() => null);
    if (!res?.ok) {
      setError(res ? await errorFrom(res, "Couldn't send that report.") : "Couldn't reach the server.");
      return;
    }
    setReported(true);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      {relationship.kind === "friends" && (
        <>
          <Link
            href={`/watch/${viewerUsername}/${profileUsername}`}
            className="rounded-card bg-paper px-4 py-1.5 font-medium text-carbon hover:bg-white"
          >
            What should we watch?
          </Link>
          <button type="button" onClick={removeFriend} disabled={busy} className="text-ash hover:text-warn disabled:opacity-50">
            Remove friend
          </button>
        </>
      )}
      {relationship.kind === "none" && (
        <button
          type="button"
          onClick={sendRequest}
          disabled={busy}
          className="rounded-card bg-paper px-4 py-1.5 font-medium text-carbon hover:bg-white disabled:opacity-50"
        >
          Add friend
        </button>
      )}
      {relationship.kind === "requested_out" && (
        <>
          <span className="text-ash">Friend request sent</span>
          <button type="button" onClick={cancelRequest} disabled={busy} className="text-ash hover:text-warn disabled:opacity-50">
            Cancel
          </button>
        </>
      )}
      {relationship.kind === "requested_in" && (
        <>
          <button
            type="button"
            onClick={() => respond(relationship.requestId, "accept")}
            disabled={busy}
            className="rounded-card bg-paper px-4 py-1.5 font-medium text-carbon hover:bg-white disabled:opacity-50"
          >
            Accept friend request
          </button>
          <button
            type="button"
            onClick={() => respond(relationship.requestId, "decline")}
            disabled={busy}
            className="text-ash hover:text-warn disabled:opacity-50"
          >
            Decline
          </button>
        </>
      )}
      <button
        type="button"
        onClick={block}
        disabled={busy}
        className="text-ash hover:text-warn disabled:opacity-50"
      >
        Block
      </button>
      <button type="button" onClick={report} disabled={reported} className="text-ash hover:text-paper disabled:opacity-60">
        {reported ? "Reported" : "Report"}
      </button>
      {error && <p className="w-full text-sm text-warn">{error}</p>}
    </div>
  );
}
