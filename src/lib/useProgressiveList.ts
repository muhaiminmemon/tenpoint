"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders `items` in growing slices instead of mounting hundreds of poster
 * images and list rows at once. The full array still lives in memory (sort,
 * filter, and counts all need it), only the DOM gets paginated: a sentinel
 * element at the bottom pulls in the next slice once it nears the viewport.
 */
export function useProgressiveList<T>(items: T[], step = 30) {
  const [count, setCount] = useState(step);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // a new filter/sort/saved-view produces a new array; start over from the top
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setCount(step);
  }

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
