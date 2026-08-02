import { GENRES_BY_ID } from "./tmdb";

/**
 * The browse query, as a thing the URL can hold.
 *
 * Every filter lives in the query string rather than component state, so a
 * search is a link: shareable, bookmarkable, and correct under the back
 * button. It also means the grid renders on the server with no loading
 * flash — the page arrives already filtered.
 */

export type SortKey = "popular" | "rated" | "new" | "grossing" | "voted";

export const SORTS: { key: SortKey; label: string; tmdb: string }[] = [
  { key: "popular", label: "Popular now", tmdb: "popularity.desc" },
  { key: "rated", label: "Highest rated", tmdb: "vote_average.desc" },
  { key: "new", label: "Newest", tmdb: "primary_release_date.desc" },
  { key: "voted", label: "Most rated", tmdb: "vote_count.desc" },
  { key: "grossing", label: "Biggest", tmdb: "revenue.desc" },
];

/**
 * Which body of opinion the grid is ordered by.
 *
 * `tmdb` runs against TMDB's index, which covers every film but only knows
 * TMDB's own audience score. `imdb` and `rt` run against scores cached locally
 * by the backfill, so they cover far fewer films and are honest leaderboards
 * rather than a filter over everything.
 */
export type Source = "tmdb" | "imdb" | "rt";

export const SOURCES: { key: Source; label: string; note: string }[] = [
  { key: "tmdb", label: "TMDB audience", note: "Every film TMDB has a record of." },
  { key: "imdb", label: "IMDb", note: "Ranked among the films we hold IMDb scores for." },
  { key: "rt", label: "Tomatometer", note: "Ranked among the films we hold critic scores for." },
];

export const BROWSE_GENRES: { id: number; name: string }[] = [
  28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37,
].map((id) => ({ id, name: GENRES_BY_ID[id] }));

export const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1940, 1930, 1920];

/** ISO 639-1, in the order a person browsing world cinema would look for them. */
export const LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "fr", name: "French" },
  { code: "it", name: "Italian" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "zh", name: "Chinese" },
  { code: "cn", name: "Cantonese" },
  { code: "hi", name: "Hindi" },
  { code: "fa", name: "Persian" },
  { code: "ru", name: "Russian" },
  { code: "sv", name: "Swedish" },
  { code: "da", name: "Danish" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "ar", name: "Arabic" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
];

export type RuntimeBand = "short" | "mid" | "long";

export const RUNTIMES: { key: RuntimeBand; label: string; gte?: number; lte?: number }[] = [
  { key: "short", label: "Under 90 min", lte: 90 },
  { key: "mid", label: "90 to 150 min", gte: 90, lte: 150 },
  { key: "long", label: "Over 150 min", gte: 150 },
];

export const MIN_RATINGS = [60, 70, 80, 90];

/** The oldest year worth offering; TMDB's records thin out fast before this. */
const FIRST_YEAR = 1920;

export function yearOptions(): number[] {
  const last = new Date().getFullYear();
  return Array.from({ length: last - FIRST_YEAR + 1 }, (_, i) => last - i);
}

/**
 * A well-regarded film almost nobody has logged.
 *
 * The band is deliberately narrow at both ends. Below the floor a score is
 * built from too few opinions to mean anything; above the ceiling the film is
 * simply known. This is the one filter here that no popularity-first site
 * would build, and the reason it exists is the reader who watches festival
 * titles alongside the canon.
 */
export const GEM_VOTES_MIN = 200;
export const GEM_VOTES_MAX = 1500;
export const GEM_RATING_MIN = 7;

export type BrowseFilters = {
  source: Source;
  sort: SortKey;
  genre: number | null;
  decade: number | null;
  /** an exact year; when set it wins over `decade`, which it fully contains */
  year: number | null;
  language: string | null;
  runtime: RuntimeBand | null;
  /** minimum average out of 10, in tenths to stay off floats */
  minRating: number | null;
  gems: boolean;
  page: number;
};

export const DEFAULT_SORT: SortKey = "popular";

export const EMPTY_FILTERS: BrowseFilters = {
  source: "tmdb",
  sort: DEFAULT_SORT,
  genre: null,
  decade: null,
  year: null,
  language: null,
  runtime: null,
  minRating: null,
  gems: false,
  page: 1,
};

/** Reads filters out of a URL, ignoring anything malformed rather than throwing. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): BrowseFilters {
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const num = (k: string) => {
    const n = Number.parseInt(one(k) ?? "", 10);
    return Number.isFinite(n) ? n : null;
  };

  const sortRaw = one("sort");
  const sourceRaw = one("src");
  const langRaw = one("lang");
  const runtimeRaw = one("len");
  const year = num("year");
  const years = yearOptions();

  const f: BrowseFilters = {
    source: SOURCES.some((s) => s.key === sourceRaw) ? (sourceRaw as Source) : "tmdb",
    sort: SORTS.some((s) => s.key === sortRaw) ? (sortRaw as SortKey) : DEFAULT_SORT,
    genre: BROWSE_GENRES.some((g) => g.id === num("genre")) ? num("genre") : null,
    decade: DECADES.includes(num("decade") ?? -1) ? num("decade") : null,
    year: year !== null && years.includes(year) ? year : null,
    language: LANGUAGES.some((l) => l.code === langRaw) ? (langRaw as string) : null,
    runtime: RUNTIMES.some((r) => r.key === runtimeRaw) ? (runtimeRaw as RuntimeBand) : null,
    minRating: MIN_RATINGS.includes(num("min") ?? -1) ? num("min") : null,
    gems: one("gems") === "1",
    page: Math.min(Math.max(num("page") ?? 1, 1), 500),
  };

  return normalise(f);
}

/**
 * Resolves the combinations that would otherwise contradict each other.
 *
 * Left alone these are the holes a reader falls into: a decade and a year that
 * disagree, a hidden-gem search sorted by "most rated" (which asks for the
 * best-known of the least-known), or a language filter carried into a
 * leaderboard whose rows have no language column to filter on. Each is
 * resolved here, once, so no caller has to remember.
 */
export function normalise(f: BrowseFilters): BrowseFilters {
  const out = { ...f };

  // A year is inside a decade, so the narrower one wins and the other clears.
  if (out.year !== null) out.decade = null;

  if (out.gems) {
    // "Most rated" and "Biggest" both order by fame, which is the opposite of
    // the question being asked.
    if (out.sort === "voted" || out.sort === "grossing" || out.sort === "popular") {
      out.sort = "rated";
    }
    // The gem band already sets a rating floor; a second one only fights it.
    out.minRating = null;
  }

  // The rating source changes which number the grid is ordered by, not which
  // films it can ask about: the local catalogue carries language, vote counts,
  // genres, year and runtime, so every filter survives the switch. Only the
  // sort is implied — picking IMDb *is* the ordering.
  if (out.source !== "tmdb") out.sort = "rated";

  return out;
}

/** The inverse: filters back to a query string, omitting anything at its default. */
export function filtersToQuery(f: Partial<BrowseFilters>): string {
  const full = normalise({ ...EMPTY_FILTERS, ...f });
  const p = new URLSearchParams();
  if (full.source !== "tmdb") p.set("src", full.source);
  if (full.sort !== DEFAULT_SORT && full.source === "tmdb") p.set("sort", full.sort);
  if (full.genre) p.set("genre", String(full.genre));
  if (full.decade) p.set("decade", String(full.decade));
  if (full.year) p.set("year", String(full.year));
  if (full.language) p.set("lang", full.language);
  if (full.runtime) p.set("len", full.runtime);
  if (full.minRating) p.set("min", String(full.minRating));
  if (full.gems) p.set("gems", "1");
  if (full.page && full.page > 1) p.set("page", String(full.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** True when the reader has actually asked something, rather than just arrived. */
export function isFiltered(f: BrowseFilters): boolean {
  return (
    f.source !== "tmdb" ||
    f.sort !== DEFAULT_SORT ||
    f.genre !== null ||
    f.decade !== null ||
    f.year !== null ||
    f.language !== null ||
    f.runtime !== null ||
    f.minRating !== null ||
    f.gems
  );
}

/** A short human sentence naming what the grid is currently showing. */
export function describeFilters(f: BrowseFilters): string {
  const bits: string[] = [];
  if (f.gems) bits.push("Hidden gems");
  if (f.language) bits.push(LANGUAGES.find((l) => l.code === f.language)?.name ?? "");
  if (f.genre) bits.push(BROWSE_GENRES.find((g) => g.id === f.genre)?.name ?? "");
  if (f.year) bits.push(String(f.year));
  else if (f.decade) bits.push(`${f.decade}s`);
  if (f.runtime) bits.push(RUNTIMES.find((r) => r.key === f.runtime)?.label ?? "");

  const subject = bits.filter(Boolean).join(" · ") || "All films";
  const floor = f.minRating ? `, rated ${(f.minRating / 10).toFixed(1)}+` : "";

  if (f.source !== "tmdb") {
    const label = SOURCES.find((s) => s.key === f.source)?.label ?? "";
    return `${subject}${floor}, by ${label}`;
  }
  const sort = SORTS.find((s) => s.key === f.sort)?.label ?? "";
  return `${subject}${floor}, ${sort.toLowerCase()}`;
}
