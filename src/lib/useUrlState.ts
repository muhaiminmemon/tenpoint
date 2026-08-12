"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A piece of view state that lives in the address bar instead of the component.
 *
 * Held in `useState`, a chosen view or sort dies the moment you open a film,
 * because leaving the route unmounts the component that remembered it. Coming
 * back rebuilt it from defaults: the ledger you were reading became the shelf
 * again, and the browser's restored scroll position pointed into content that
 * no longer existed there. That is the whole of "it takes you all the way
 * back".
 *
 * In the URL it survives, because the URL is what the back button restores. It
 * also makes the view shareable, which it never was.
 *
 * `replace` rather than `push`: choosing a sort is not a place you should have
 * to press back through, but it does update the entry the back button returns
 * to. `scroll: false` keeps the page still, since changing a sort should not
 * also throw you to the top.
 */
export function useUrlState<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): [T, (next: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const raw = params.get(key);
  const value = allowed.includes(raw as T) ? (raw as T) : fallback;

  const set = useCallback(
    (next: T) => {
      const p = new URLSearchParams(params.toString());
      // The default is the absence of the parameter, so a cleared view leaves a
      // clean URL rather than one carrying every default it ever touched.
      if (next === fallback) p.delete(key);
      else p.set(key, next);
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [router, pathname, params, key, fallback],
  );

  return [value, set];
}

/**
 * The same, for a search box.
 *
 * Free text needs both halves. The box holds its own value so every keystroke
 * lands immediately — routing on each one would navigate a dozen times over a
 * word nobody has finished — and the URL is written a beat later, so leaving
 * the page and coming back finds the search still in it. The sort controls
 * beside these boxes have survived a round trip for a while; the search next
 * to them silently did not, which is the half people actually notice.
 *
 * The URL stays the authority: when it changes from outside — the back button,
 * a shared link, a clear — that value is adopted. `seen` is what tells the two
 * apart, so an external change is taken and the echo of our own write is not.
 *
 * Read from `window.location.search` rather than the hook's params, because the
 * params object is a new identity every render and would re-arm the timer on
 * each one.
 */
export function useUrlText(key: string, delay = 350): [string, (next: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = params.get(key) ?? "";

  const [text, setText] = useState(fromUrl);
  const seen = useRef(fromUrl);

  useEffect(() => {
    if (seen.current !== fromUrl) {
      seen.current = fromUrl;
      setText(fromUrl);
    }
  }, [fromUrl]);

  useEffect(() => {
    if (text === fromUrl) return;
    const timer = setTimeout(() => {
      const p = new URLSearchParams(window.location.search);
      if (text) p.set(key, text);
      else p.delete(key);
      const q = p.toString();
      seen.current = text;
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }, delay);
    return () => clearTimeout(timer);
  }, [text, fromUrl, key, delay, pathname, router]);

  return [text, setText];
}

/** The same, for a bounded integer such as a page or a month offset. */
export function useUrlNumber(
  key: string,
  fallback: number,
  max: number,
): [number, (next: number) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const parsed = Number.parseInt(params.get(key) ?? "", 10);
  const value = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), max) : fallback;

  const set = useCallback(
    (next: number) => {
      const p = new URLSearchParams(params.toString());
      if (next === fallback) p.delete(key);
      else p.set(key, String(next));
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [router, pathname, params, key, fallback],
  );

  return [value, set];
}
