import { NextResponse } from "next/server";
import { POSTER_SIZES, TMDB_IMAGE_BASE, type PosterSize } from "@/lib/tmdb-urls";

/**
 * Serves TMDB poster images from our own origin.
 *
 * Loading them directly from `image.tmdb.org` meant 24 third-party requests on
 * the landing page alone, and content blockers — Brave Shields by default,
 * uBlock, Firefox strict mode — stall or drop them. The page rendered but the
 * poster wall stayed empty and the tab span forever. Proxying makes every
 * image same-origin, so there is nothing for a blocker to categorise, and
 * TMDB stops seeing our visitors' browsers.
 *
 * A pass-through rather than a re-encode: posters at these sizes are already
 * ~10KB, so spending container CPU to shave bytes would cost more than it saves.
 */

// TMDB poster paths are content-addressed — a given filename is always the
// same bytes — so this can be cached hard and forever.
const CACHE = "public, max-age=31536000, immutable";

/**
 * Strictly allowlisted. Without both of these checks, `size` and `file` are
 * attacker-controlled path segments in a URL we then fetch, which is an open
 * proxy: a way to make our server issue arbitrary requests and return the
 * result. The size must be one we actually use, and the filename must be a
 * bare TMDB image name with no traversal.
 */
const FILE_PATTERN = /^[A-Za-z0-9]+\.(jpg|png|webp|svg)$/;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ size: string; file: string }> },
) {
  const { size, file } = await ctx.params;

  if (!POSTER_SIZES.includes(size as PosterSize) || !FILE_PATTERN.test(file)) {
    return new NextResponse(null, { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${TMDB_IMAGE_BASE}/${size}/${file}`, {
      // Cached by Next between requests, so a popular poster is fetched from
      // TMDB once rather than once per viewer.
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
  } catch {
    // TMDB unreachable: a missing poster degrades to the grey placeholder the
    // components already render, which is better than a failed page.
    return new NextResponse(null, { status: 502 });
  }

  if (!upstream.ok) return new NextResponse(null, { status: upstream.status });

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": CACHE,
      // Third-party bytes served from our origin; never let a browser sniff
      // something executable out of them.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
