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
  /** where a touch went down, so a drag can be told apart from a tap */
  const startRef = useRef<{ x: number; y: number } | null>(null);
  /** set once a touch has travelled far enough to count as handling the card */
  const draggingRef = useRef(false);

  const finePointer = useMediaQuery(FINE_POINTER);
  const reduced = useMediaQuery(REDUCED_MOTION);
  const active = !reduced;

  /** Distance in px before a touch stops being a tap and starts being a drag. */
  const DRAG_THRESHOLD = 8;

  const paint = useCallback(
    (frame: HTMLDivElement, clientX: number, clientY: number, lift: number) => {
      const rect = frame.getBoundingClientRect();
      const dx = (clientX - rect.left) / rect.width - 0.5;
      const dy = (clientY - rect.top) / rect.height - 0.5;

      frame.style.transition = "none";
      frame.style.transform =
        `perspective(1100px) rotateX(${(-dy * 2 * maxTilt).toFixed(2)}deg)` +
        ` rotateY(${(dx * 2 * maxTilt).toFixed(2)}deg) scale(${lift})`;

      const light = glareRef.current;
      if (light) {
        light.style.transition = "none";
        light.style.background =
          `radial-gradient(42% 58% at ${((dx + 0.5) * 100).toFixed(1)}% ${((dy + 0.5) * 100).toFixed(1)}%,` +
          ` rgba(255,255,255,${glare}), rgba(255,255,255,0) 68%)`;
      }
    },
    [maxTilt, glare],
  );

  const onEnter = useCallback(() => {
    if (!active || !finePointer) return;
    // Promoted only while in use: `will-change` is itself a containing block,
    // and leaving one on every card permanently is worse than the paint it
    // saves.
    if (frameRef.current) frameRef.current.style.willChange = "transform";
  }, [active, finePointer]);

  /**
   * A touch begins as a tap until it proves otherwise.
   *
   * The card is a button first, so a finger landing on it must not tilt
   * anything — that was the whole reason touch was excluded. What is safe is
   * *movement*: once a finger has travelled past the threshold it is plainly
   * handling the card rather than pressing it, and from there the tilt follows
   * it exactly as the cursor does.
   */
  const onDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!active || e.pointerType === "mouse") return;
      startRef.current = { x: e.clientX, y: e.clientY };
      draggingRef.current = false;
      if (frameRef.current) frameRef.current.style.willChange = "transform";
    },
    [active],
  );

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!active) return;
      const frame = frameRef.current;
      if (!frame) return;

      if (e.pointerType === "mouse") {
        if (!finePointer) return;
        paint(frame, e.clientX, e.clientY, 1.015);
        return;
      }

      const start = startRef.current;
      if (!start) return;
      if (!draggingRef.current) {
        const far = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (far < DRAG_THRESHOLD) return;
        draggingRef.current = true;
      }
      // A touch is holding the card, so it lifts a little further than a
      // cursor merely passing over one.
      paint(frame, e.clientX, e.clientY, 1.03);
    },
    [active, finePointer, paint],
  );

  const onLeave = useCallback(() => {
    startRef.current = null;
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

  /**
   * A drag must not also open the card.
   *
   * Released after handling it, the browser still fires a click on the button
   * underneath. Caught here in the capture phase, before it reaches the button
   * at all, and only when a drag actually happened — a plain tap is untouched.
   */
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = false;
  }, []);

  return (
    <div
      ref={frameRef}
      onPointerEnter={onEnter}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onLeave}
      onPointerCancel={onLeave}
      onPointerLeave={onLeave}
      onClickCapture={onClickCapture}
      style={{
        // `pan-y` keeps the page scrollable through the card while claiming
        // sideways movement for the tilt. `none` would trap vertical scrolling
        // on a card that fills most of a phone screen.
        touchAction: "pan-y",
        // A press and hold on a phone is how you select text and raise the
        // copy callout, and both of those cancel the gesture before it can
        // become a drag. The card is a printed object, not a paragraph:
        // nothing on it is meant to be selected, so nothing on it is.
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
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
