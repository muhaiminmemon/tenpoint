/** Ratings are tenths (10..100) end to end; formatting is the only float math. */
export function formatTenths(tenths: number): string {
  return (tenths / 10).toFixed(1);
}

/**
 * Each film gets its own quiet accent, stable across renders, so a group of
 * films reads as a set of distinct things rather than one repeated colour.
 */
const ACCENTS = ["#8faecc", "#d9b25f", "#8fbf7f", "#c4756a", "#a99ad9", "#6fb0a8"];

export function accentFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

/** "8", "8.7", "10" → tenths; anything else → null. */
export function parseRatingInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d{1,2}([.,]\d)?$/.test(trimmed)) return null;
  const n = parseFloat(trimmed.replace(",", "."));
  if (!isFinite(n) || n < 1 || n > 10) return null;
  return Math.round(n * 10);
}

/**
 * Today as YYYY-MM-DD in the *viewer's* timezone. `toISOString()` would give
 * the UTC date, which pre-fills tomorrow for anyone west of Greenwich logging
 * in the evening.
 */
export function todayLocalISO(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Ratings carry one accent: gold for the 9.0+ shelf. Everything below reads as
 * plain text, so the eye finds a personal favourite without the whole column
 * turning into a heat map.
 */
export function ratingColor(tenths: number | null): string {
  if (tenths === null) return "text-ash";
  if (tenths >= 90) return "text-gold";
  if (tenths >= 70) return "text-paper";
  return "text-ash";
}

export function decadeLabel(decade: number): string {
  return `${String(decade).slice(-2)}s`;
}

export const RATING_ANCHORS: { range: string; meaning: string }[] = [
  { range: "9.0–10.0", meaning: "Exceptional: a personal favourite" },
  { range: "8.0–8.9", meaning: "Great" },
  { range: "7.0–7.9", meaning: "Good" },
  { range: "6.0–6.9", meaning: "Decent" },
  { range: "5.0–5.9", meaning: "Mixed" },
  { range: "4.0–4.9", meaning: "Disliked" },
  { range: "1.0–3.9", meaning: "Strongly disliked" },
];
