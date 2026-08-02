"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Server snapshot is `false`; the delay only shortens after hydration. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED_MOTION);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * Keeps a component mounted long enough to animate itself out.
 *
 * Every overlay in this app arrived with an animation and left by vanishing:
 * `if (!open) return null` removes the node on the same frame the state flips,
 * so a sheet that took 280ms to rise disappeared in zero. That asymmetry is
 * what reads as snappy — not the speed of the entrance, but the absence of an
 * exit. Closing is a movement too, and the eye needs to see where the thing
 * went.
 *
 * Returns `rendered` (mount the node while true) and `state` ("in" or "out"),
 * which the node maps to an entering or leaving class.
 *
 * Exits run shorter than entrances. An arrival can afford to be composed; a
 * dismissal that lingers feels like the interface arguing with you.
 */
export function usePresence(open: boolean, exitMs = 180) {
  const [rendered, setRendered] = useState(open);
  const reduced = usePrefersReducedMotion();

  // Adjusting state during render rather than in an effect: opening must mount
  // on this frame, and an effect would cost one where the node is absent.
  if (open && !rendered) setRendered(true);

  // With reduced motion the exit keyframes are switched off, so holding the
  // node for the animation's length would just leave it sitting there before
  // blinking out — worse than the instant close it replaced.
  const hold = reduced ? 0 : exitMs;

  useEffect(() => {
    if (open) return;
    // Always through a timer, including at zero: a `setState` in the effect
    // body is a synchronous re-render mid-commit, and a zero timeout lands on
    // the next tick, which is imperceptible.
    const timer = setTimeout(() => setRendered(false), hold);
    return () => clearTimeout(timer);
  }, [open, hold]);

  return { rendered, state: open ? ("in" as const) : ("out" as const) };
}
