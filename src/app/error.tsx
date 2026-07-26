"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Catches anything thrown while rendering a page: a dropped database
 * connection, a TMDB timeout, a bad query. Without this the user gets Next's
 * bare "Application error" with no way back.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="display text-2xl text-paper">That didn&apos;t load</h1>
      <p className="mt-3 text-sm text-ash">
        Something broke on our side, not yours. Nothing you logged has been lost.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-card bg-paper px-4 py-2 text-sm font-medium text-carbon hover:bg-white"
        >
          Try again
        </button>
        <Link
          href="/library"
          className="rounded-card border border-seam px-4 py-2 text-sm text-paper hover:bg-tray"
        >
          Back to your library
        </Link>
      </div>
      {error.digest && (
        // The digest is the only handle on the server-side stack, so it needs
        // to be quotable in a bug report.
        <p className="num mt-6 text-xs text-ash">Reference: {error.digest}</p>
      )}
    </div>
  );
}
