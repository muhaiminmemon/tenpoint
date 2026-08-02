import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { films, type Film } from "@/db/schema";
import { directorOf, GENRES_BY_ID, movieDetails, releaseYear, type TmdbMovie } from "./tmdb";

export function slugify(title: string, year: number | null): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return year ? `${base}-${year}` : base || "film";
}

/** Insert or return the cached film row for a TMDB search result. */
export async function ensureFilm(movie: TmdbMovie): Promise<Film> {
  const existing = await db.select().from(films).where(eq(films.tmdbId, movie.id)).limit(1);
  if (existing[0]) return existing[0];

  const year = releaseYear(movie);
  let slug = slugify(movie.title, year);
  const clash = await db.select({ id: films.id }).from(films).where(eq(films.slug, slug)).limit(1);
  if (clash[0]) slug = `${slug}-${movie.id}`;

  const inserted = await db
    .insert(films)
    .values({
      tmdbId: movie.id,
      slug,
      title: movie.title,
      year,
      releaseDate: movie.release_date || null,
      originalLanguage: movie.original_language ?? null,
      posterPath: movie.poster_path ?? null,
      backdropPath: movie.backdrop_path ?? null,
      overview: movie.overview ?? null,
    })
    .onConflictDoNothing({ target: films.tmdbId })
    .returning();
  if (inserted[0]) return inserted[0];
  // lost a race, so the row exists now
  const won = await db.select().from(films).where(eq(films.tmdbId, movie.id)).limit(1);
  return won[0];
}

/** Batch upsert of TMDB list results; returns all matching film rows keyed by tmdbId. */
export async function bulkEnsureFilms(movies: TmdbMovie[]): Promise<Map<number, Film>> {
  const unique = new Map<number, TmdbMovie>();
  for (const m of movies) if (!unique.has(m.id)) unique.set(m.id, m);
  const ids = [...unique.keys()];
  if (!ids.length) return new Map();

  const existing = ids.length
    ? await db.select().from(films).where(inArray(films.tmdbId, ids))
    : [];
  const byTmdb = new Map(existing.filter((f) => f.tmdbId).map((f) => [f.tmdbId!, f]));

  const missing = [...unique.values()].filter((m) => !byTmdb.has(m.id));
  for (const chunk of chunked(missing, 100)) {
    const values = chunk.map((m) => {
      const year = releaseYear(m);
      return {
        tmdbId: m.id,
        // suffix keeps slugs collision-free in bulk; single inserts get clean slugs
        slug: `${slugify(m.title, year)}-${m.id}`,
        title: m.title,
        year,
        posterPath: m.poster_path ?? null,
        backdropPath: m.backdrop_path ?? null,
        overview: m.overview ?? null,
        genres: m.genre_ids?.map((g) => GENRES_BY_ID[g]).filter(Boolean) ?? null,
        popularity: m.popularity ?? null,
        voteCount: m.vote_count ?? null,
      };
    });
    const inserted = await db.insert(films).values(values).onConflictDoNothing().returning();
    for (const f of inserted) if (f.tmdbId) byTmdb.set(f.tmdbId, f);
  }
  // pick up rows that lost insert races
  const still = ids.filter((id) => !byTmdb.has(id));
  if (still.length) {
    for (const f of await db.select().from(films).where(inArray(films.tmdbId, still))) {
      if (f.tmdbId) byTmdb.set(f.tmdbId, f);
    }
  }
  return byTmdb;
}

function chunked<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const STALE_MS = 30 * 24 * 60 * 60 * 1000;

/** Fill in director/runtime/genres on demand; refresh stale metadata. */
export async function hydrateFilm(film: Film): Promise<Film> {
  if (!film.tmdbId) return film;
  const fresh = film.refreshedAt && Date.now() - film.refreshedAt.getTime() < STALE_MS;
  if (film.director && film.imdbId && film.releaseDate && film.originalLanguage && fresh)
    return film;
  try {
    const details = await movieDetails(film.tmdbId);
    const updated = await db
      .update(films)
      .set({
        title: details.title ?? film.title,
        year: releaseYear(details) ?? film.year,
        releaseDate: details.release_date || film.releaseDate,
        originalLanguage: details.original_language ?? film.originalLanguage,
        posterPath: details.poster_path ?? film.posterPath,
        backdropPath: details.backdrop_path ?? film.backdropPath,
        director: directorOf(details) ?? film.director,
        runtime: details.runtime ?? film.runtime,
        genres: details.genres?.map((g) => g.name) ?? film.genres,
        castNames:
          details.credits?.cast?.slice(0, 10).map((c) => c.name) ?? film.castNames,
        keywords:
          details.keywords?.keywords?.slice(0, 15).map((k) => k.name) ?? film.keywords,
        popularity: details.popularity ?? film.popularity,
        voteCount: details.vote_count ?? film.voteCount,
        overview: details.overview ?? film.overview,
        // Taken from TMDB rather than matched on title: OMDb answers a wrong
        // id with a real film's scores instead of an error, so a guess here
        // would surface someone else's ratings under this film's name.
        imdbId: details.imdb_id ?? film.imdbId,
        refreshedAt: new Date(),
      })
      .where(eq(films.id, film.id))
      .returning();
    return updated[0] ?? film;
  } catch {
    // metadata refresh is best-effort; the page still renders
    return film;
  }
}

/**
 * Whether a film is still ahead of its own release.
 *
 * Compared as plain `YYYY-MM-DD` strings against the server's date, so no
 * timezone arithmetic is involved: the question is which calendar day the
 * release falls on, not which instant.
 *
 * A film with no date on file is treated as released. TMDB is missing dates
 * for plenty of older and smaller titles, and refusing to let someone log a
 * 1930s film because its metadata is thin would be the wrong way round — an
 * unknown date is far more often an old film than an unreleased one.
 */
export function isUnreleased(film: { releaseDate: string | null }): boolean {
  if (!film.releaseDate) return false;
  return film.releaseDate > new Date().toISOString().slice(0, 10);
}
