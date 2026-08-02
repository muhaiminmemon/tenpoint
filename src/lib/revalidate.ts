import { revalidatePath } from "next/cache";

/**
 * Cache invalidation, kept out of `http.ts`.
 *
 * `next/cache` is server-only, and `http.ts` is imported by client components
 * for `readJson` and `errorFrom` — putting the two together broke the build.
 * Same split as `browse.ts` and `browse-query.ts`: anything that can only run
 * on the server lives in its own module.
 */
/**
 * Invalidates everything a rating changes.
 *
 * `router.refresh()` only refreshes the route you are standing on, so rating a
 * film on `/film/x` left the home page holding whatever the client had already
 * prefetched — including the old tier. Someone could rank up and see nothing
 * until they hard-reloaded, which is exactly what it looked like: a rank-up
 * that "took a while".
 *
 * Listed explicitly rather than revalidating the whole layout, so browse and
 * the marketing pages are not thrown away every time somebody logs a film.
 */
export function revalidateAfterEntryChange(username?: string): void {
  for (const path of ["/", "/library", "/diary", "/binder", "/watchlist", "/feed"]) {
    revalidatePath(path);
  }
  if (username) revalidatePath(`/${username}`);
}
