"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useScrollMemory } from "@/lib/useScrollMemory";

/**
 * Puts every page back where it was, not just the library.
 *
 * This lived inside the library list, which meant the one screen anybody
 * tested worked and every other one still threw the reader to the top: the
 * diary, the browse grid, a profile, the feed, search results. Scroll position
 * is not a property of a list component, it is a property of a route, so it
 * belongs once in the layout rather than being remembered separately by
 * whichever component happens to be tall.
 *
 * Mounted in the root layout, it re-keys whenever the route changes, which
 * saves the outgoing position and restores the incoming one in the same pass.
 * See `useScrollMemory` for why it retries and why it only ever fires on the
 * back and forward buttons.
 */
export default function ScrollRestoration() {
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  useScrollMemory(query ? `${pathname}?${query}` : pathname);
  return null;
}
