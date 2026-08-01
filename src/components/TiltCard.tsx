"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * Tilts whatever it wraps toward the pointer, with a specular highlight that
 * rakes across the surface as the cursor moves.
 *
 * The card is the product's identity artifact and the most-looked-at thing in
 * the app; flat until clicked, it reads as a picture of an object rather than
 * an object. This is the cheapest way to close that gap: no dependency, no
 * animation loop, and nothing happening at all until someone points at it.
 *
 * Three things it is careful about:
 *
 * - **A transform creates a containing block for `position: fixed`.** Wrap the
 *   card, never a subtree that also contains a dialog or sheet, or the overlay
 *   will be positioned against the card and clipped by it.
 * - **Reduced motion has to be checked here.** The global media block in
 *   `globals.css` zeroes animation and transition durations, but this writes
 *   `transform` straight to the node, which no stylesheet rule can stop.
 * - **Transforms are written imperatively, never through state.** One React
 *   render per `pointermove` is a stutter you can feel.
 */

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Server snapshot is `false`, so the effect stays off until hydration. */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export default function TiltCard({
  children,
  /** matches the wrapped card's own radius, so the highlight keeps its corners */
  radius,
  /**
   * Degrees at the very edge. Deliberately under the 9° the reference used:
   * this card carries dense small text and tabular ratings, and past about six
   * the tenths start to shimmer.
   */
  maxTilt = 5,
  /** peak highlight alpha; graphite needs far less than a bright surface */
  glare = 0.12,
  className = "",
}: {
  children: React.ReactNode;
  radius: string;
  maxTilt?: number;
  glare?: number;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLSpanElement>(null);

  const finePointer = useMediaQuery(FINE_POINTER);
  const reduced = useMediaQuery(REDUCED_MOTION);
  const active = finePointer && !reduced;

  const onEnter = useCallback(() => {
    if (!active) return;
    // Promoted only while in use: `will-change` is itself a containing block,
    // and leaving one on every card permanently is worse than the paint it
    // saves.
    if (frameRef.current) frameRef.current.style.willChange = "transform";
  }, [active]);

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!active || e.pointerType !== "mouse") return;
      const frame = frameRef.current;
      if (!frame) return;

      const rect = frame.getBoundingClientRect();
      const dx = (e.clientX - rect.left) / rect.width - 0.5;
      const dy = (e.clientY - rect.top) / rect.height - 0.5;

      frame.style.transition = "none";
      frame.style.transform =
        `perspective(1100px) rotateX(${(-dy * 2 * maxTilt).toFixed(2)}deg)` +
        ` rotateY(${(dx * 2 * maxTilt).toFixed(2)}deg) scale(1.015)`;

      const light = glareRef.current;
      if (light) {
        light.style.transition = "none";
        light.style.background =
          `radial-gradient(42% 58% at ${((dx + 0.5) * 100).toFixed(1)}% ${((dy + 0.5) * 100).toFixed(1)}%,` +
          ` rgba(255,255,255,${glare}), rgba(255,255,255,0) 68%)`;
      }
    },
    [active, maxTilt, glare],
  );

  const onLeave = useCallback(() => {
    const frame = frameRef.current;
    if (frame) {
      frame.style.transition = "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)";
      frame.style.transform = "";
      frame.style.willChange = "";
    }
    const light = glareRef.current;
    if (light) {
      light.style.transition = "background 420ms ease-out";
      light.style.background = "transparent";
    }
  }, []);

  return (
    <div
      ref={frameRef}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`relative ${className}`}
    >
      {children}
      {/* Its own border-radius clips the highlight, so the wrapper never needs
          `overflow: hidden` — which would cut off the tier's glow. */}
      <span
        ref={glareRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{ borderRadius: radius }}
      />
    </div>
  );
}
