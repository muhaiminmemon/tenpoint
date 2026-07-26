"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorFrom } from "@/lib/http";

export type ReportRow = {
  id: string;
  subjectType: string;
  subjectId: string;
  reason: string;
  status: string;
  createdAt: Date;
  reporterUsername: string | null;
  /** Filled in for review/comment reports, so a moderator can read the text. */
  subjectText: string | null;
  subjectAuthor: string | null;
  subjectFilmSlug: string | null;
};

export default function ReportQueue({ reports }: { reports: ReportRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(id: string, status: "resolved" | "dismissed" | "open") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        setError(await errorFrom(res, "Couldn't update that report."));
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusyId(null);
    }
  }

  if (!reports.length) {
    return <p className="text-ash">Nothing reported. Quiet week.</p>;
  }

  return (
    <>
      {error && <p className="mb-4 text-sm text-warn">{error}</p>}
      <ul className="space-y-4">
        {reports.map((r) => (
          <li key={r.id} className="rounded-card border border-seam bg-tray p-4">
            <div className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-ash">
              <span className="uppercase tracking-wide text-paper">{r.subjectType}</span>
              <span className="num">{new Date(r.createdAt).toISOString().slice(0, 10)}</span>
              {r.reporterUsername && (
                <span>
                  from{" "}
                  <Link href={`/${r.reporterUsername}`} className="underline hover:text-paper">
                    {r.reporterUsername}
                  </Link>
                </span>
              )}
              {r.status !== "open" && (
                <span className="rounded-full border border-seam px-2 py-0.5 text-[11px]">
                  {r.status}
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-paper">{r.reason}</p>

            {r.subjectText ? (
              <blockquote className="mt-3 border-l-2 border-seam pl-3 text-sm text-ash">
                {r.subjectAuthor && (
                  <span className="block text-[13px] text-paper">
                    <Link href={`/${r.subjectAuthor}`} className="hover:underline">
                      {r.subjectAuthor}
                    </Link>
                    {r.subjectFilmSlug && (
                      <>
                        {" on "}
                        <Link href={`/film/${r.subjectFilmSlug}`} className="hover:underline">
                          this film
                        </Link>
                      </>
                    )}
                  </span>
                )}
                {r.subjectText}
              </blockquote>
            ) : (
              <p className="num mt-3 text-xs text-ash">
                {/* The reported thing may already be gone: reports outlive the
                    rows they point at, since deletions cascade and this table
                    stores a loose id rather than a foreign key. */}
                {r.subjectType === "user" ? `user ${r.subjectId}` : "content no longer exists"}
              </p>
            )}

            <div className="mt-3 flex items-center gap-3 text-[13px]">
              {r.status === "open" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStatus(r.id, "resolved")}
                    disabled={busyId === r.id}
                    className="rounded-card border border-seam px-3 py-1 text-paper hover:bg-carbon disabled:opacity-50"
                  >
                    Acted on it
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus(r.id, "dismissed")}
                    disabled={busyId === r.id}
                    className="text-ash hover:text-paper disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setStatus(r.id, "open")}
                  disabled={busyId === r.id}
                  className="text-ash hover:text-paper disabled:opacity-50"
                >
                  Reopen
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
