// Client-safe poster URL helper (no server deps).

/** Upstream. Only `/api/poster/[size]/[file]` should ever fetch from this. */
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export const POSTER_SIZES = ["w154", "w342", "w500"] as const;
export type PosterSize = (typeof POSTER_SIZES)[number];

/**
 * Posters are served from our own origin, not from `image.tmdb.org`.
 *
 * Pointing straight at TMDB meant every poster was a third-party request, and
 * content blockers stall those by default — the landing page rendered with an
 * empty grid and the tab loaded forever in Brave, while working fine in
 * browsers that don't block. Same-origin URLs have nothing to categorise.
 *
 * Every call site goes through this function, so the proxy is transparent:
 * nothing else in the codebase knows where posters come from.
 */
export function posterUrl(
  path: string | null | undefined,
  size: PosterSize = "w342",
): string | null {
  if (!path) return null;
  // TMDB paths arrive with a leading slash, e.g. "/abc123.jpg".
  const file = path.replace(/^\/+/, "");
  if (!file) return null;
  return `/api/poster/${size}/${file}`;
}
