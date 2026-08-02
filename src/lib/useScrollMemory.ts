"use client";

import { useEffect } from "react";

/**
 * Whether the last navigation was the back or forward button.
 *
 * Only those should land mid-page. Tapping "Library" in the nav is a fresh
 * arrival and belongs at the top, even though the position from earlier in the
 * session is still on file.
 */
let fromHistory = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    fromHistory = true;
  });
}

/**
 * Puts a long list back where it was, on phones as well as desktops.
 *
 * Filters and sorts already survive a round trip, because they live in the
 * URL. The scroll position does not: the browser restores it from history,
 * and it can only restore a position the document is currently tall enough to
 * hold. A library renders in slices of thirty, so on the way back the page is
 * a few hundred pixels tall for a moment and a request to scroll to 4,000 is
 * silently clamped to the bottom of what exists. Desktop usually gets away
 * with it — the grid is wide, the slice is most of the screen, and the rest
 * arrives before anyone notices. A phone shows one poster per column, so the
 * same slice is far shorter than the position being restored, and it lands at
 * the top instead.
 *
 * So the position is remembered here and reapplied over the first second,
 * retrying while the list grows underneath it, and giving up the moment it
 * lands or somebody scrolls themselves.
 */
export function useScrollMemory(key: string) {
  useEffect(() => {
    const slot = `tenpoint:scroll:${key}`;

    const target = Number.parseInt(sessionStorage.getItem(slot) ?? "", 10);
    const restoring = fromHistory;
    fromHistory = false;
    let settled = !restoring || !Number.isFinite(target) || target <= 0;
    let timer = 0;
    const started = Date.now();

    function attempt() {
      if (settled) return;
      // Reachable now? Then this is the last attempt either way: landing short
      // of a target the document can hold means it was never going to work.
      const reachable =
        document.documentElement.scrollHeight - window.innerHeight >= target - 4;
      window.scrollTo(0, target);
      if (reachable || Date.now() - started > 1200) {
        settled = true;
        return;
      }
      timer = window.setTimeout(attempt, 90);
    }

    // After paint, so the restored slice is measured rather than guessed at.
    const raf = requestAnimationFrame(() => requestAnimationFrame(attempt));

    /**
     * Written at the moments a position is about to be lost, never on scroll.
     *
     * A `scroll` listener is banned: it runs on every frame of every scroll for
     * a value only needed at the end of one. The three moments that actually
     * matter are leaving by a link (React unmounts this), the tab going away
     * (`pagehide`), and the tab being hidden (`visibilitychange`, which is the
     * one iOS fires when an app is backgrounded).
     */
    function remember() {
      // Not while the restore is still chasing its target: recording the
      // clamped position it is passing through would overwrite the real one.
      if (!settled) return;
      sessionStorage.setItem(slot, String(Math.round(window.scrollY)));
    }

    function onHide() {
      if (document.visibilityState === "hidden") remember();
    }

    function onTouch() {
      // A hand on the screen outranks a restore in progress.
      settled = true;
    }

    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("wheel", onTouch, { passive: true });
    // `pagehide` rather than `beforeunload`: the only one iOS Safari fires
    // reliably when a page goes into the back-forward cache.
    window.addEventListener("pagehide", remember);
    document.addEventListener("visibilitychange", onHide);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("wheel", onTouch);
      window.removeEventListener("pagehide", remember);
      document.removeEventListener("visibilitychange", onHide);
      // Leaving by a link is the case the whole hook exists for, and no event
      // fires for it: React unmounting this is the notice.
      sessionStorage.setItem(slot, String(Math.round(window.scrollY)));
    };
  }, [key]);
}
