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

  /**
   * Start over from the top when the *question* changes, not whenever the array
   * does.
   *
   * A new filter, sort or slice is a different list and deserves a fresh slice,
   * and all three live in the URL, so the memory key already names them. Array
   * identity does not: re-fetching the same list — which is what a refresh after
   * an edit is — also produces a new array, and collapsing six hundred rendered
   * rows back to thirty shrinks the document under a reader who has not moved,
   * throwing their scroll position hundreds of pixels. Callers with no memory
   * key keep the old behaviour, having named nothing better.
   */
  const [prevKey, setPrevKey] = useState(memoryKey);
  const [prevItems, setPrevItems] = useState(items);
  if (memoryKey === undefined ? items !== prevItems : memoryKey !== prevKey) {
    setPrevKey(memoryKey);
    setPrevItems(items);
    setCount(step);
  } else if (items !== prevItems) {
    setPrevItems(items);
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
