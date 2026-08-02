"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders `items` in growing slices instead of mounting hundreds of poster
 * images and list rows at once. The full array still lives in memory (sort,
 * filter, and counts all need it), only the DOM gets paginated: a sentinel
 * element at the bottom pulls in the next slice once it nears the viewport.
 */
export function useProgressiveList<T>(items: T[], step = 30, memoryKey?: string) {
  const [count, setCount] = useState(step);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // a new filter/sort/saved-view produces a new array; start over from the top
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setCount(step);
  }

  /**
   * How much was on screen last time, so a restored scroll position has
   * something to land on.
   *
   * Seeded rather than read during render: the server has no session storage,
   * so starting anywhere but `step` would hydrate against different markup.
   * The deferred set is what keeps that out of the render pass.
   */
  useEffect(() => {
    if (!memoryKey) return;
    const slot = `tenpoint:shown:${memoryKey}`;
    const saved = Number.parseInt(sessionStorage.getItem(slot) ?? "", 10);
    if (Number.isFinite(saved) && saved > step) {
      const t = setTimeout(() => setCount((c) => Math.max(c, Math.min(saved, 600))), 0);
      return () => clearTimeout(t);
    }
  }, [memoryKey, step]);

  useEffect(() => {
    if (!memoryKey || count <= step) return;
    sessionStorage.setItem(`tenpoint:shown:${memoryKey}`, String(count));
  }, [memoryKey, count, step]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setCount((c) => Math.min(items.length, c + step));
        }
      },
      { rootMargin: "800px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length, step]);

  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    total: items.length,
    sentinelRef,
  };
}
