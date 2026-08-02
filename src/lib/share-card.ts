/**
 * The share formats, in one place because both halves need them: the route
 * that draws the image and the panel that offers it have to agree on what
 * "story" means down to the pixel, or the preview stops being the thing that
 * gets shared.
 */
export type ShareFmt = "story" | "square" | "wide";

export const SHARE_SIZES: Record<ShareFmt, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  wide: { width: 1920, height: 1080 },
};

export const SHARE_FORMATS: {
  key: ShareFmt;
  label: string;
  aspect: string;
  caption: string;
}[] = [
  { key: "story", label: "Story 9:16", aspect: "9 / 16", caption: "1080 × 1920 · PNG" },
  { key: "square", label: "Square 1:1", aspect: "1 / 1", caption: "1080 × 1080 · PNG" },
  { key: "wide", label: "Wide 16:9", aspect: "16 / 9", caption: "1920 × 1080 · PNG" },
];

/** Where the drawn card lives. One URL, so preview and share cannot diverge. */
export function shareImageUrl(username: string, fmt: ShareFmt, hideNums: boolean): string {
  const p = new URLSearchParams({ fmt });
  if (hideNums) p.set("hide", "1");
  return `/api/card/${encodeURIComponent(username)}?${p.toString()}`;
}
