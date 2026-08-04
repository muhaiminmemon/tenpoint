import type { ImportRow } from "./letterboxd";
import malMap from "./mal-map.json";

/**
 * Reading a MyAnimeList export.
 *
 * MAL hands out gzipped XML from its export panel: one `<anime>` element per
 * entry, carrying MAL's own catalogue id, a score out of ten, a status, and
 * the dates you started and finished. Nothing in it refers to TMDB, which is
 * the only catalogue this site knows, so the ids are translated through a
 * mapping built by scripts/build-mal-map.ts.
 *
 * The reason this fits at all is that MAL files each season of a series as a
 * separate entry with its own score, which is exactly how Tenpoint stores
 * television. Their unit of opinion and ours are the same, so a list lands as
 * season rows rather than being flattened into one verdict per series.
 */

/** `[tmdbId, season]`, where season 0 means the entry is a film. */
const MAP = malMap as unknown as Record<string, [number, number]>;

export type MalRow = ImportRow & {
  /** MAL's own id, kept so a row can be re-resolved without re-parsing */
  malId: number | null;
  /** the TMDB id this resolves to, when the mapping knows it */
  tmdbId: number | null;
  /**
   * The TMDB season this entry is, or null when it is a film.
   *
   * Present here rather than looked up later because it is the difference
   * between "Attack on Titan" and "the third season of Attack on Titan", and
   * MAL is the only thing that knows which one the score was for.
   */
  season: number | null;
};

/** MAL writes 0000-00-00 for "not set", which Postgres will not take. */
function malDate(raw: string | undefined | null): string | null {
  const s = (raw ?? "").trim();
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s) || s.startsWith("0000")) return null;
  return s;
}

/**
 * One to ten, in whole numbers, against our tenths.
 *
 * MAL has no half stars, so this is the one conversion in the codebase that
 * loses nothing: a 7 is a 7.0. Zero means unrated rather than terrible, which
 * is worth being careful about, since treating it as a score would hand
 * everybody a shelf of ones.
 */
export function malScoreToTenths(raw: string | number | null | undefined): number | null {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(100, Math.max(10, Math.round(n) * 10));
}

/** Pulls one tag's text, tolerating CDATA and attributes. */
function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  if (!m) return null;
  return m[1]
    .replace(/^\s*<!\[CDATA\[/, "")
    .replace(/\]\]>\s*$/, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

/**
 * Whether this upload is a MAL export at all.
 *
 * Checked on content rather than the filename: MAL names the download after
 * the account and the date, and people rename it.
 */
export function isMalExport(text: string): boolean {
  return /<myanimelist[\s>]/i.test(text) && /<anime[\s>]/i.test(text);
}

/**
 * Every status MAL records, against what it means here.
 *
 * "Plan to Watch" is the watchlist. Everything else is something they have
 * actually watched some of, and is imported as watched: a dropped series is
 * still a series you saw three episodes of and formed an opinion about, and
 * refusing to import those would throw away most of a heavy user's list.
 */
function kindFor(status: string, rating: number | null, watchedOn: string | null): ImportRow["kind"] {
  if (/plan\s*to\s*watch/i.test(status)) return "watchlist";
  if (watchedOn) return "diary";
  return rating !== null ? "ratings" : "watched";
}

export function parseMalXml(text: string): { rows: MalRow[]; total: number } | null {
  if (!isMalExport(text)) return null;

  const rows: MalRow[] = [];
  const blocks = text.match(/<anime[\s>][\s\S]*?<\/anime>/gi) ?? [];

  blocks.forEach((block, i) => {
    const title = tag(block, "series_title");
    if (!title) return;

    const malId = Number.parseInt(tag(block, "series_animedb_id") ?? "", 10);
    const status = tag(block, "my_status") ?? "";
    const rating = malScoreToTenths(tag(block, "my_score"));
    // The date they finished is the date they watched it, as far as a diary is
    // concerned. Falling back to the start date is better than no date at all
    // for anything abandoned part way.
    const watchedOn = malDate(tag(block, "my_finish_date")) ?? malDate(tag(block, "my_start_date"));
    const mapped = Number.isFinite(malId) ? MAP[String(malId)] : undefined;

    rows.push({
      key: `mal-${i}`,
      kind: kindFor(status, rating, watchedOn),
      name: title,
      // MAL's export carries no year. The mapping resolves the title exactly,
      // and where it does not, the title search has to manage without one.
      year: null,
      uri: Number.isFinite(malId) ? `https://myanimelist.net/anime/${malId}` : null,
      rating,
      watchedOn,
      // A rewatch count above zero says they have been round again, but not
      // when, so it cannot become dated viewings. It marks the one entry.
      rewatch: (Number.parseInt(tag(block, "my_times_watched") ?? "0", 10) || 0) > 0,
      malId: Number.isFinite(malId) ? malId : null,
      tmdbId: mapped ? mapped[0] : null,
      season: mapped ? (mapped[1] === 0 ? null : mapped[1]) : null,
    });
  });

  if (rows.length === 0) return null;
  return { rows, total: blocks.length };
}
