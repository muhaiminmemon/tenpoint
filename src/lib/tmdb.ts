export { posterUrl, TMDB_IMAGE_BASE } from "./tmdb-urls";

const TMDB_BASE = "https://api.themoviedb.org/3";

export type TmdbMovie = {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  popularity?: number;
  vote_count?: number;
  vote_average?: number;
  original_language?: string;
  genre_ids?: number[];
};

export type TmdbMovieDetails = TmdbMovie & {
  /** the join key to anything outside TMDB; absent on a few obscure entries */
  imdb_id?: string | null;
  runtime?: number | null;
  genres?: { id: number; name: string }[];
  credits?: {
    crew?: { job: string; name: string }[];
    cast?: { name: string; order?: number }[];
  };
  keywords?: { keywords?: { name: string }[] };
};

/** TMDB's fixed movie-genre taxonomy, so list results carry names without extra calls. */
export const GENRES_BY_ID: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Science Fiction", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
};

export class TmdbError extends Error {}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new TmdbError("TMDB_API_KEY is not set. Add it to .env.local.");
  }
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new TmdbError(`TMDB request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function searchMovies(query: string, year?: number): Promise<TmdbMovie[]> {
  const params: Record<string, string> = { query, include_adult: "false" };
  if (year) params.primary_release_year = String(year);
  const data = await tmdb<{ results: TmdbMovie[] }>("/search/movie", params);
  return data.results ?? [];
}

export type TmdbPerson = {
  id: number;
  name: string;
  popularity?: number;
  profile_path?: string | null;
  /** TMDB's own guess at what they are known for: Directing, Acting, Writing */
  known_for_department?: string;
};

/** People, so a browse query can mean a director or somebody in the cast. */
export async function searchPeople(query: string): Promise<TmdbPerson[]> {
  const data = await tmdb<{ results: TmdbPerson[] }>("/search/person", { query });
  return data.results ?? [];
}

export async function movieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
  return tmdb<TmdbMovieDetails>(`/movie/${tmdbId}`, {
    append_to_response: "credits,keywords",
  });
}

export async function topRatedMovies(page: number): Promise<TmdbMovie[]> {
  const data = await tmdb<{ results: TmdbMovie[] }>("/movie/top_rated", { page: String(page) });
  return data.results ?? [];
}

export async function popularMovies(page: number): Promise<TmdbMovie[]> {
  const data = await tmdb<{ results: TmdbMovie[] }>("/movie/popular", { page: String(page) });
  return data.results ?? [];
}

/**
 * The year's best, as TMDB sees it. Ranked by vote count rather than raw
 * popularity so a film people actually watched beats one that merely trended,
 * and gated on a vote floor so a January release with four votes can't lead.
 */
export async function topMoviesOfYear(year: number, page = 1): Promise<TmdbMovie[]> {
  const data = await tmdb<{ results: TmdbMovie[] }>("/discover/movie", {
    "primary_release_date.gte": `${year}-01-01`,
    "primary_release_date.lte": `${year}-12-31`,
    sort_by: "vote_count.desc",
    "vote_count.gte": "100",
    include_adult: "false",
    page: String(page),
  });
  return data.results ?? [];
}

export async function discoverByGenre(genreId: number, page: number): Promise<TmdbMovie[]> {
  const data = await tmdb<{ results: TmdbMovie[] }>("/discover/movie", {
    with_genres: String(genreId),
    sort_by: "vote_count.desc",
    "vote_count.gte": "300",
    include_adult: "false",
    page: String(page),
  });
  return data.results ?? [];
}

export async function discoverByDirectorName(name: string): Promise<TmdbMovie[]> {
  const people = await tmdb<{ results: { id: number; known_for_department?: string }[] }>(
    "/search/person",
    { query: name, include_adult: "false" },
  );
  const person = people.results?.find((p) => p.known_for_department === "Directing") ??
    people.results?.[0];
  if (!person) return [];
  const data = await tmdb<{ results: TmdbMovie[] }>("/discover/movie", {
    with_crew: String(person.id),
    sort_by: "vote_count.desc",
    "vote_count.gte": "100",
    include_adult: "false",
  });
  return data.results ?? [];
}

export function releaseYear(m: { release_date?: string }): number | null {
  const y = m.release_date?.slice(0, 4);
  return y ? Number(y) : null;
}

export function directorOf(details: TmdbMovieDetails): string | null {
  const directors = details.credits?.crew?.filter((c) => c.job === "Director") ?? [];
  return directors.length ? directors.map((d) => d.name).join(", ") : null;
}

/** One page of discover results, with the pagination TMDB reports back. */
export type DiscoverPage = {
  results: TmdbMovie[];
  page: number;
  totalPages: number;
  totalResults: number;
};

/**
 * The browse query. Every filter here maps to a `/discover/movie` parameter,
 * so the grid is TMDB's own index rather than anything we maintain.
 *
 * TMDB caps pagination at page 500, which is why browsing is filtered rather
 * than one endless list: no single query can reach past 10,000 films, and the
 * way to anything beyond that is to narrow the question.
 */
export async function discoverMovies(params: Record<string, string>): Promise<DiscoverPage> {
  const data = await tmdb<{
    results: TmdbMovie[];
    page: number;
    total_pages: number;
    total_results: number;
  }>("/discover/movie", { include_adult: "false", ...params });

  return {
    results: data.results ?? [],
    page: data.page ?? 1,
    totalPages: Math.min(data.total_pages ?? 1, 500),
    totalResults: data.total_results ?? 0,
  };
}

/** In cinemas now, as TMDB tracks it. */
export async function nowPlaying(page = 1): Promise<TmdbMovie[]> {
  const data = await tmdb<{ results: TmdbMovie[] }>("/movie/now_playing", {
    page: String(page),
  });
  return data.results ?? [];
}

/** What people are actually looking at this week. */
export async function trendingThisWeek(): Promise<TmdbMovie[]> {
  const data = await tmdb<{ results: TmdbMovie[] }>("/trending/movie/week", {});
  return data.results ?? [];
}
