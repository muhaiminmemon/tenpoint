import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { diaryEntries, films, recEvents, userFilmFlags, watchlist, type Film, type SessionUser } from "@/db/schema";
import { bulkEnsureFilms, hydrateFilm } from "./films";
import { pairKey } from "./social";
import {
  discoverByDirectorName,
  discoverByGenre,
  GENRES_BY_ID,
  popularMovies,
  topRatedMovies,
  TmdbError,
  type TmdbMovie,
} from "./tmdb";

const GENRE_IDS_BY_NAME: Record<string, number> = Object.fromEntries(
  Object.entries(GENRES_BY_ID).map(([id, name]) => [name, Number(id)]),
);

const MIN_RATED = 20;
const MIN_STRONG = 5;
const STRONG_TENTHS = 80;

export type RecResult =
  | { eligible: false; shortfall: { username: string; rated: number; strong: number }[] }
  | { eligible: true; films: RecFilm[] };

export type RecFilm = {
  filmId: string;
  slug: string;
  tmdbId: number | null;
  title: string;
  year: number | null;
  posterPath: string | null;
  director: string | null;
  blurb: string;
};

type RatedFilm = { film: Film; rating: number };

type Profile = {
  user: SessionUser;
  mean: number;
  genreW: Map<string, number>;
  directorW: Map<string, number>;
  decadeW: Map<string, number>;
  castW: Map<string, number>;
  keywordW: Map<string, number>;
  watchlistFilmIds: Set<string>;
};

async function ratedFilmsOf(userId: string): Promise<RatedFilm[]> {
  const rows = await db.execute(sql`
    select distinct on (d.film_id) d.film_id, d.rating
    from diary_entries d
    where d.user_id = ${userId} and d.rating is not null
    order by d.film_id, d.watched_on desc nulls last, d.created_at desc
  `);
  const list = rows as unknown as { film_id: string; rating: number }[];
  if (!list.length) return [];
  const filmRows = await db
    .select()
    .from(films)
    .where(inArray(films.id, list.map((r) => r.film_id)));
  const byId = new Map(filmRows.map((f) => [f.id, f]));
  return list
    .map((r) => ({ film: byId.get(r.film_id)!, rating: r.rating }))
    .filter((r) => r.film);
}

function bump(map: Map<string, number>, key: string | null | undefined, w: number) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + w);
}

function normalize(map: Map<string, number>) {
  let max = 0;
  for (const v of map.values()) max = Math.max(max, Math.abs(v));
  if (max === 0) return;
  for (const [k, v] of map) map.set(k, v / max);
}

function decadeOf(year: number | null): string | null {
  return year ? `${Math.floor(year / 10) * 10}s` : null;
}

async function buildProfile(user: SessionUser, rated: RatedFilm[]): Promise<Profile> {
  const mean = rated.reduce((s, r) => s + r.rating, 0) / rated.length;

  // strongest films drive director signal; fill missing directors (bounded)
  const strong = rated
    .filter((r) => r.rating >= Math.max(STRONG_TENTHS, mean + 5))
    .sort((a, b) => b.rating - a.rating);
  let hydrated = 0;
  for (const r of strong) {
    if (hydrated >= 8) break;
    if (!r.film.director && r.film.tmdbId) {
      r.film = await hydrateFilm(r.film);
      hydrated++;
    }
  }

  const genreW = new Map<string, number>();
  const directorW = new Map<string, number>();
  const decadeW = new Map<string, number>();
  const castW = new Map<string, number>();
  const keywordW = new Map<string, number>();

  for (const { film, rating } of rated) {
    // normalized to each user's own distribution: distance from their mean
    const w = (rating - mean) / 10;
    for (const g of film.genres ?? []) bump(genreW, g, w);
    bump(decadeW, decadeOf(film.year), w);
    if (w > 0) {
      bump(directorW, film.director, w);
      for (const c of film.castNames ?? []) bump(castW, c, w);
      for (const k of film.keywords ?? []) bump(keywordW, k, w);
    }
  }
  for (const m of [genreW, directorW, decadeW, castW, keywordW]) normalize(m);

  const wl = await db
    .select({ filmId: watchlist.filmId })
    .from(watchlist)
    .where(eq(watchlist.userId, user.id));

  return {
    user,
    mean,
    genreW,
    directorW,
    decadeW,
    castW,
    keywordW,
    watchlistFilmIds: new Set(wl.map((w) => w.filmId)),
  };
}

function topKeys(map: Map<string, number>, n: number): string[] {
  return [...map.entries()]
    .filter(([, v]) => v > 0)
    .sort((x, y) => y[1] - x[1])
    .slice(0, n)
    .map(([k]) => k);
}

/** Candidate pool: watchlists + local catalogue + TMDB staples, loved directors, shared genres. */
async function gatherCandidates(pa: Profile, pb: Profile): Promise<Film[]> {
  const tmdbMovies: TmdbMovie[] = [];
  const pull = async (fn: () => Promise<TmdbMovie[]>) => {
    try {
      tmdbMovies.push(...(await fn()));
    } catch (e) {
      if (!(e instanceof TmdbError)) throw e;
      // recommendation quality degrades gracefully without TMDB
    }
  };

  await Promise.all([
    pull(() => topRatedMovies(1)),
    pull(() => topRatedMovies(2)),
    pull(() => topRatedMovies(3)),
    pull(() => popularMovies(1)),
    pull(() => popularMovies(2)),
  ]);

  const sharedGenres = topKeys(pa.genreW, 5).filter((g) => (pb.genreW.get(g) ?? 0) > 0.1);
  for (const g of sharedGenres.slice(0, 3)) {
    const id = GENRE_IDS_BY_NAME[g];
    if (id) {
      await pull(() => discoverByGenre(id, 1));
      await pull(() => discoverByGenre(id, 2));
    }
  }

  const directors = [...new Set([...topKeys(pa.directorW, 5), ...topKeys(pb.directorW, 5)])];
  for (const d of directors.slice(0, 6)) {
    await pull(() => discoverByDirectorName(d.split(", ")[0]));
  }

  const ensured = await bulkEnsureFilms(tmdbMovies);

  const local = await db
    .select()
    .from(films)
    .where(sql`${films.tmdbId} is not null`)
    .orderBy(sql`${films.voteCount} desc nulls last`)
    .limit(1500);

  const byId = new Map<string, Film>();
  for (const f of local) byId.set(f.id, f);
  for (const f of ensured.values()) byId.set(f.id, f);
  return [...byId.values()];
}

type Scored = { film: Film; combined: number; perUser: [number, number] };

function rawScore(p: Profile, film: Film): number {
  const genres = film.genres ?? [];
  const g = genres.length
    ? genres.reduce((s, x) => s + (p.genreW.get(x) ?? 0), 0) / genres.length
    : 0;
  const d = film.director ? (p.directorW.get(film.director) ?? 0) : 0;
  const dec = p.decadeW.get(decadeOf(film.year) ?? "") ?? 0;
  const cast = film.castNames?.length
    ? film.castNames.reduce((s, c) => s + (p.castW.get(c) ?? 0), 0) / film.castNames.length
    : 0;
  const kw = film.keywords?.length
    ? film.keywords.reduce((s, k) => s + (p.keywordW.get(k) ?? 0), 0) / film.keywords.length
    : 0;
  const quality = Math.min(1, Math.log10((film.voteCount ?? 0) + 1) / 4);
  const wlBonus = p.watchlistFilmIds.has(film.id) ? 0.25 : 0;
  return 1.6 * g + 1.4 * d + 0.7 * dec + 0.6 * cast + 0.6 * kw + 0.35 * quality + wlBonus;
}

/** Rank-percentile per user, then the pair takes the LOWER of the two. */
function scoreAll(candidates: Film[], pa: Profile, pb: Profile): Scored[] {
  const rawA = candidates.map((f) => rawScore(pa, f));
  const rawB = candidates.map((f) => rawScore(pb, f));
  const pctOf = (raw: number[]) => {
    const sorted = [...raw].sort((x, y) => x - y);
    const denom = Math.max(1, sorted.length - 1);
    /*
     * A value's percentile is how many entries fall strictly below it, which
     * is the index where it first appears in the sorted array. Walking
     * backwards leaves the *lowest* index for each distinct value, so ties
     * share a rank. Building this map once is what keeps a 2000-candidate
     * batch from doing 4M comparisons in a scan-per-candidate.
     */
    const firstIndex = new Map<number, number>();
    for (let i = sorted.length - 1; i >= 0; i--) firstIndex.set(sorted[i], i);
    return raw.map((v) => (firstIndex.get(v) ?? 0) / denom);
  };
  const pctA = pctOf(rawA);
  const pctB = pctOf(rawB);
  return candidates.map((film, i) => ({
    film,
    combined: Math.min(pctA[i], pctB[i]),
    perUser: [pctA[i], pctB[i]] as [number, number],
  }));
}

function diversify(scored: Scored[], n: number): Scored[] {
  const byDirector = new Map<string, number>();
  const byGenre = new Map<string, number>();
  const out: Scored[] = [];
  for (const s of scored.sort((x, y) => y.combined - x.combined)) {
    const dir = s.film.director ?? "";
    const genre = s.film.genres?.[0] ?? "";
    if (dir && (byDirector.get(dir) ?? 0) >= 2) continue;
    if (genre && (byGenre.get(genre) ?? 0) >= 3) continue;
    out.push(s);
    if (dir) byDirector.set(dir, (byDirector.get(dir) ?? 0) + 1);
    if (genre) byGenre.set(genre, (byGenre.get(genre) ?? 0) + 1);
    if (out.length >= n) break;
  }
  return out;
}

function nameOf(u: SessionUser): string {
  return u.displayName ?? u.username;
}

/** Explanations are templated from real data, never generated. */
function blurbFor(s: Scored, pa: Profile, pb: Profile): string {
  const f = s.film;
  const onA = pa.watchlistFilmIds.has(f.id);
  const onB = pb.watchlistFilmIds.has(f.id);
  if (onA && onB) return "On both of your watchlists.";
  if (onA || onB) return `Already on ${nameOf(onA ? pa.user : pb.user)}'s watchlist.`;

  if (f.director) {
    const da = pa.directorW.get(f.director) ?? 0;
    const dbb = pb.directorW.get(f.director) ?? 0;
    if (da > 0.2 && dbb > 0.2)
      return `Directed by ${f.director}, whose films rate highly with both of you.`;
    if (da > 0.35 || dbb > 0.35)
      return `Directed by ${f.director}, a favourite of ${nameOf(da > dbb ? pa.user : pb.user)}.`;
  }

  const shared = (f.genres ?? [])
    .map((g) => ({ g, v: Math.min(pa.genreW.get(g) ?? 0, pb.genreW.get(g) ?? 0) }))
    .filter((x) => x.v > 0.1)
    .sort((x, y) => y.v - x.v);
  if (shared.length >= 2)
    return `Matches your shared taste for ${shared[0].g.toLowerCase()} with ${shared[1].g.toLowerCase()}.`;
  if (shared.length === 1) return `You both rate ${shared[0].g.toLowerCase()} films highly.`;

  const dec = decadeOf(f.year);
  if (dec && (pa.decadeW.get(dec) ?? 0) > 0.15 && (pb.decadeW.get(dec) ?? 0) > 0.15)
    return `From the ${dec}, a decade you both come back to.`;

  return "Widely loved, and close to films you both rate well.";
}

export async function eligibilityOf(userId: string): Promise<{ rated: number; strong: number }> {
  const rows = await db.execute(sql`
    with current as (
      select distinct on (film_id) rating
      from diary_entries
      where user_id = ${userId} and rating is not null
      order by film_id, watched_on desc nulls last, created_at desc
    )
    select count(*)::int as rated,
           count(*) filter (where rating >= ${STRONG_TENTHS})::int as strong
    from current
  `);
  const r = (rows as unknown as { rated: number; strong: number }[])[0];
  return { rated: r?.rated ?? 0, strong: r?.strong ?? 0 };
}

export async function recommendForPair(a: SessionUser, b: SessionUser): Promise<RecResult> {
  const [ea, eb] = await Promise.all([eligibilityOf(a.id), eligibilityOf(b.id)]);
  const shortfall = [
    { username: a.username, ...ea },
    { username: b.username, ...eb },
  ].filter((e) => e.rated < MIN_RATED || e.strong < MIN_STRONG);
  if (shortfall.length) return { eligible: false, shortfall };

  const [ratedA, ratedB] = await Promise.all([ratedFilmsOf(a.id), ratedFilmsOf(b.id)]);
  const [pa, pb] = await Promise.all([buildProfile(a, ratedA), buildProfile(b, ratedB)]);

  // filter set: anything either has logged, dismissed, or already seen
  const loggedIds = new Set([...ratedA, ...ratedB].map((r) => r.film.id));
  const allEntries = await db
    .select({ filmId: diaryEntries.filmId })
    .from(diaryEntries)
    .where(inArray(diaryEntries.userId, [a.id, b.id]));
  for (const e of allEntries) loggedIds.add(e.filmId);
  const flags = await db
    .select({ filmId: userFilmFlags.filmId })
    .from(userFilmFlags)
    .where(inArray(userFilmFlags.userId, [a.id, b.id]));
  for (const f of flags) loggedIds.add(f.filmId);

  const key = pairKey(a.id, b.id);
  const shownRows = await db
    .select({ filmId: recEvents.filmId })
    .from(recEvents)
    .where(and(eq(recEvents.pairKey, key), eq(recEvents.event, "shown")));
  let shown = new Set(shownRows.map((r) => r.filmId));

  const candidates = (await gatherCandidates(pa, pb)).filter(
    (f) => !loggedIds.has(f.id) && f.posterPath,
  );

  let pool = candidates.filter((f) => !shown.has(f.id));
  if (pool.length < 5 && shown.size > 0) {
    // rotation exhausted: forget what was shown and start over
    await db
      .delete(recEvents)
      .where(and(eq(recEvents.pairKey, key), eq(recEvents.event, "shown")));
    shown = new Set();
    pool = candidates;
  }

  const picked = diversify(scoreAll(pool, pa, pb), 5);

  if (picked.length) {
    await db
      .insert(recEvents)
      .values(picked.map((s) => ({ pairKey: key, filmId: s.film.id, event: "shown" })));
  }

  return {
    eligible: true,
    films: picked.map((s) => ({
      filmId: s.film.id,
      slug: s.film.slug,
      tmdbId: s.film.tmdbId,
      title: s.film.title,
      year: s.film.year,
      posterPath: s.film.posterPath,
      director: s.film.director,
      blurb: blurbFor(s, pa, pb),
    })),
  };
}
