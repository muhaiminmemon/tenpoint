import { eq } from "drizzle-orm";
import { db } from "@/db";
import { films, type Film } from "@/db/schema";

/**
 * Critic scores from OMDb: Rotten Tomatoes, Metacritic, and IMDb's average.
 *
 * Keyed strictly by the IMDb id TMDB gives us. OMDb answers an unknown id with
 * a different film's data rather than an error, so a guessed or title-matched
 * id does not fail loudly — it renders someone else's scores under this film's
 * name. If `imdbId` is absent, the scores are absent too. That is the whole
 * rule.
 *
 * The free tier allows 1,000 requests a day, which is why this caches onto the
 * film row and is only ever called from a film's own page. It cannot back a
 * grid: twenty posters on screen would be twenty requests, and a few dozen
 * page views would spend the day's budget.
 */

const OMDB_BASE = "https://www.omdbapi.com/";

/**
 * Critic scores settle within weeks of release and then barely move, so a long
 * window is honest and keeps the daily budget for films nobody has looked at
 * yet. A miss is cached too — without that, every view of a film OMDb has
 * never heard of would spend another request re-learning the same thing.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const SETTLED_MS = 30 * DAY_MS;
const FRESH_RELEASE_MS = 7 * DAY_MS;
/** How long after release a film's scores are still moving enough to recheck. */
const STILL_MOVING_MS = 120 * DAY_MS;

/**
 * A four-day-old release has a Tomatometer that changes weekly; a 1974 film's
 * has not moved in decades. One flat window would either waste the daily
 * budget re-asking about settled films or leave new releases stale for a month.
 */
function staleAfter(film: Film): number {
  if (!film.releaseDate) return SETTLED_MS;
  const age = Date.now() - new Date(film.releaseDate).getTime();
  return age < STILL_MOVING_MS ? FRESH_RELEASE_MS : SETTLED_MS;
}

export type CriticScores = {
  /** 0–100 */
  rtScore: number | null;
  /** 0–100 */
  metacritic: number | null;
  /** tenths, e.g. 88 for 8.8 */
  imdbRating: number | null;
  imdbVotes: number | null;
};

type OmdbResponse = {
  Response?: string;
  Ratings?: { Source?: string; Value?: string }[];
  imdbRating?: string;
  imdbVotes?: string;
  Metascore?: string;
};

/** "87%" → 87. Anything unparseable is absent rather than zero. */
function percent(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseInt(value.replace("%", ""), 10);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

/** "8.8" → 88. Kept in tenths so no rating in this codebase is ever a float. */
function tenths(value: string | undefined): number | null {
  if (!value || value === "N/A") return null;
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return Math.round(n * 10);
}

function parse(data: OmdbResponse): CriticScores {
  const rt = data.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value;
  const votes = data.imdbVotes && data.imdbVotes !== "N/A"
    ? Number.parseInt(data.imdbVotes.replace(/,/g, ""), 10)
    : null;

  return {
    rtScore: percent(rt),
    metacritic: percent(data.Metascore === "N/A" ? undefined : data.Metascore),
    imdbRating: tenths(data.imdbRating),
    imdbVotes: Number.isFinite(votes as number) ? (votes as number) : null,
  };
}

/**
 * The film's scores, fetched and cached on first look and refreshed rarely.
 *
 * Returns whatever is already on the row when the key is missing, the id is
 * unknown, or OMDb is unreachable — external scores are a garnish, and a film
 * page must never fail because a third party did.
 */
export async function criticScores(film: Film): Promise<CriticScores> {
  const stored: CriticScores = {
    rtScore: film.rtScore,
    metacritic: film.metacritic,
    imdbRating: film.imdbRating,
    imdbVotes: film.imdbVotes,
  };

  const key = process.env.OMDB_API_KEY;
  // The backfill writes an empty string to mean "TMDB has no id for this",
  // which is falsy and so already reads as absent here.
  if (!key || !film.imdbId) return stored;

  const fresh =
    film.scoresRefreshedAt &&
    Date.now() - film.scoresRefreshedAt.getTime() < staleAfter(film);
  if (fresh) return stored;

  try {
    const url = `${OMDB_BASE}?i=${encodeURIComponent(film.imdbId)}&apikey=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return stored;

    const data = (await res.json()) as OmdbResponse;
    // OMDb reports failure in the body with a 200, so the status is not enough.
    if (data.Response === "False") {
      // Stamp anyway: a film OMDb does not know is a fact worth remembering
      // for thirty days rather than rediscovering on every page view.
      await db
        .update(films)
        .set({ scoresRefreshedAt: new Date() })
        .where(eq(films.id, film.id));
      return stored;
    }

    const scores = parse(data);
    await db
      .update(films)
      .set({ ...scores, scoresRefreshedAt: new Date() })
      .where(eq(films.id, film.id));
    return scores;
  } catch {
    // no key, rate limited, offline, or slow — the page renders without them
    return stored;
  }
}
