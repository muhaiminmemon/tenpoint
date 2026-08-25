"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

  const grow = useCallback(() => {
    setCount((c) => Math.min(items.length, c + step));
  }, [items.length, step]);

  /**
   * Pull in the next slice while the foot of the list is near the viewport.
   *
   * This was an IntersectionObserver, and it stopped the list dead at its first
   * slice — "Showing 30 of 196" however far you scrolled. An observer reports
   * *changes* in intersection, so a sentinel that loads a slice and then stays
   * on screen never reports again.
   *
   * Measuring the sentinel on scroll has no such blind spot, and `count` is a
   * dependency so each slice re-checks and the list keeps filling until the
   * foot is genuinely out of reach. Throttled on a timer rather than a frame
   * because animation frames stop entirely in a tab the browser considers idle,
   * and a list that quietly refuses to grow is the bug this is fixing.
   */
  useEffect(() => {
    if (count >= items.length) return;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      pending = null;
      const el = sentinelRef.current;
      if (el && el.getBoundingClientRect().top - window.innerHeight < 800) grow();
    };
    const onScroll = () => {
      if (!pending) pending = setTimeout(check, 100);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // deferred, so the first measurement happens after this render has painted
    // and never sets state during the effect itself
    pending = setTimeout(check, 0);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (pending) clearTimeout(pending);
    };
  }, [items.length, step, count, grow]);

  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    total: items.length,
    sentinelRef,
    /** the explicit way through, for when scrolling alone hasn't got there */
    showMore: grow,
  };
}
