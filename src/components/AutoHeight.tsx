"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Eases a container between content heights instead of jumping.
 *
 * Swapping a panel's contents changes its height on the same frame, so the
 * whole dialog snaps to a new size and everything under it lurches. That jump
 * is the part that reads as cheap: the new content is fine, the *arrival* of it
 * is what feels abrupt.
 *
 * `height: auto` cannot be transitioned, so the height is measured with a
 * ResizeObserver and written as an explicit pixel value. The observer also
 * covers changes this component never hears about — an image finishing load, a
 * font swapping in, the viewport getting narrower and a line wrapping — which
 * is why it beats measuring once on a state change.
 *
 * The first measurement matches what `auto` was already rendering, so it
 * produces no visible transition; only real changes after that animate.
 * Reduced motion is handled by the global rule that flattens every transition
 * duration, so this needs no branch of its own.
 */
export default function AutoHeight({
  children,
  /** milliseconds; a size change is a layout move, so it sits at the slow end */
  duration = 260,
  className = "",
  innerClassName = "",
}: {
  children: React.ReactNode;
  duration?: number;
  className?: string;
  /**
   * Padding belongs on the measured element, not the wrapper. Tailwind sets
   * `border-box`, so a padded wrapper given an explicit height would eat that
   * padding out of the content area and clip.
   */
  innerClassName?: string;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      /*
       * The border box, not the content box. `contentRect` reports the content
       * height with padding subtracted, and padding is deliberately on this
       * element rather than the wrapper, so writing that number onto a wrapper
       * that then renders the padding too clipped every consumer by exactly
       * its own vertical padding. It went unnoticed for as long as the last
       * thing in each panel had slack under it, and showed up the moment
       * something ended on a hard edge.
       */
      const box = entry.borderBoxSize?.[0];
      setHeight(box ? box.blockSize : el.offsetHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        height: height === null ? undefined : height,
        transition: `height ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
      }}
    >
      <div ref={inner} className={innerClassName}>
        {children}
      </div>
    </div>
  );
}
