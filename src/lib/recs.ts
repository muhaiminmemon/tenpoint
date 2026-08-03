import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { diaryEntries, films, recEvents, userFilmFlags, watchlist, type SessionUser } from "@/db/schema";
import { pairKey } from "./social";

/**
 * What two people should watch, predicted rather than pattern-matched.
 *
 * The previous version of this file was a bag of counts: it tallied genres,
 * directors, decades, cast and keywords from each library, scored candidates
 * by overlap, and took the lower of the two percentile ranks. Two things were
 * wrong with it, and they compounded.
 *
 * The first was the candidate pool. It came from TMDB's popular and top rated
 * pages plus a few genre discovers, which is the same two hundred famous films
 * for every pair on the service. No amount of ranking rescues a pool that does
 * not contain the answer, and the ceiling on "what should we watch" was
 * whatever The Shawshank Redemption happened to score that day.
 *
 * The second was that a bag of counts cannot tell degree from kind. Somebody
 * who loves Whiplash and Ghibli has their genre map averaged into mush, and
 * the recommender proposes the midpoint, which is a film neither half of them
 * wants. Taste is lumpy, and the model has to be local to it.
 *
 * This replaces both. Retrieval walks the precomputed neighbour lists out from
 * the films each person already loves and the films their taste neighbours
 * love, so the pool is built around this pair. Ranking predicts an actual
 * rating for each of them out of five signals, each of which reports how much
 * it knows, so a film nobody has any evidence about cannot coast to the top on
 * a confident-looking average.
 *
 * Everything it reads was computed overnight: the embeddings, the neighbour
 * lists, the credits, the critic scores. Nothing here calls an API, loads a
 * model, or writes to the catalogue.
 */

const MIN_RATED = 20;
const MIN_STRONG = 5;
const STRONG_TENTHS = 80;

/** How many to return. */
const PICKS = 5;

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
  /**
   * The model's guess at what each of them would rate it, in tenths, in the
   * order the pair was passed. Shown because it is the product's own unit and
   * a reader can check it against themselves a week later, which is more than
   * a match percentage ever offers.
   */
  predicted: { username: string; rating: number }[];
};

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

type FilmRow = {
  id: string;
  slug: string;
  tmdbId: number | null;
  title: string;
  year: number | null;
  posterPath: string | null;
  director: string | null;
  genres: string[] | null;
  castNames: string[] | null;
  embedding: number[] | null;
  similarFilms: { slug: string; why: string }[] | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  rtScore: number | null;
  metacritic: number | null;
  popularity: number | null;
};

const filmCols = {
  id: films.id,
  slug: films.slug,
  tmdbId: films.tmdbId,
  title: films.title,
  year: films.year,
  posterPath: films.posterPath,
  director: films.director,
  genres: films.genres,
  castNames: films.castNames,
  embedding: films.embedding,
  similarFilms: films.similarFilms,
  imdbRating: films.imdbRating,
  imdbVotes: films.imdbVotes,
  rtScore: films.rtScore,
  metacritic: films.metacritic,
  popularity: films.popularity,
};

type Rating = { userId: string; filmId: string; rating: number };

/**
 * One current rating per person per film.
 *
 * A film rated three times has three diary rows and only the latest is what
 * somebody thinks of it now, so every read in here goes through the same
 * distinct-on. Counting all three would let a rewatcher outvote themselves.
 */
async function currentRatingsFor(filmIds: string[]): Promise<Rating[]> {
  if (filmIds.length === 0) return [];
  const rows = await db.execute(sql`
    select distinct on (user_id, film_id) user_id, film_id, rating
    from diary_entries
    where rating is not null and film_id in ${sql`(${sql.join(filmIds.map((id) => sql`${id}::uuid`), sql`, `)})`}
    order by user_id, film_id, watched_on desc nulls last, created_at desc
  `);
  return (rows as unknown as { user_id: string; film_id: string; rating: number }[]).map((r) => ({
    userId: r.user_id,
    filmId: r.film_id,
    rating: r.rating,
  }));
}

/**
 * Everyone's average, over their whole diary rather than over the slice this
 * request happens to touch.
 *
 * Centring on a partial mean is how a generous rater looks harsh: if the only
 * films of theirs in the sample are the ones they disliked, their apparent
 * mean drops and every deviation flips sign.
 *
 * This is the one read here that grows with the whole service rather than with
 * the pair, so it is the first thing to move into a nightly table when the
 * diary count makes the scan noticeable.
 */
async function meansByUser(): Promise<Map<string, { mean: number; n: number }>> {
  const rows = await db.execute(sql`
    with cur as (
      select distinct on (user_id, film_id) user_id, rating
      from diary_entries
      where rating is not null
      order by user_id, film_id, watched_on desc nulls last, created_at desc
    )
    select user_id, avg(rating)::float as mean, count(*)::int as n
    from cur group by user_id
  `);
  const out = new Map<string, { mean: number; n: number }>();
  for (const r of rows as unknown as { user_id: string; mean: number; n: number }[]) {
    out.set(r.user_id, { mean: r.mean, n: r.n });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Vectors
 * ------------------------------------------------------------------ */

/**
 * The embedding job writes unit vectors, so the dot product is the cosine and
 * there is no length to divide out. Float32Array because this runs a few
 * hundred thousand times per request and the typed loop is several times the
 * speed of the boxed one.
 */
function vec(e: number[] | null): Float32Array | null {
  return e && e.length ? Float32Array.from(e) : null;
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/* ------------------------------------------------------------------ *
 * One person's model
 * ------------------------------------------------------------------ */

/** A rated film of theirs, held in the form the scorer wants. */
type Held = { filmId: string; title: string; rating: number; delta: number; v: Float32Array };

/**
 * How many of somebody's films the neighbourhood search reads.
 *
 * Their most opinionated ones, by distance from their own mean. A film rated
 * exactly at the mean says nothing about direction and still costs a full
 * vector comparison against every candidate.
 */
const LIB_MAX = 140;

type Person = {
  user: SessionUser;
  mean: number;
  held: Held[];
  /** shrunk average deviation for each director and face they have rated */
  directorDelta: Map<string, { sum: number; n: number }>;
  castDelta: Map<string, { sum: number; n: number }>;
  /** other accounts whose ratings move with theirs */
  neighbours: { userId: string; sim: number; mean: number }[];
  watchIds: Set<string>;
  ratedIds: Set<string>;
};

function tally(map: Map<string, { sum: number; n: number }>, key: string | null, delta: number) {
  if (!key) return;
  const cur = map.get(key) ?? { sum: 0, n: 0 };
  cur.sum += delta;
  cur.n += 1;
  map.set(key, cur);
}

/** Shrunk toward no opinion, so one film by a director is not a verdict on them. */
function shrunk(e: { sum: number; n: number } | undefined, prior: number): number {
  if (!e) return 0;
  return e.sum / (e.n + prior);
}

function buildPerson(
  user: SessionUser,
  mean: number,
  rated: Map<string, number>,
  libById: Map<string, FilmRow>,
  neighbours: { userId: string; sim: number; mean: number }[],
  watchIds: Set<string>,
): Person {
  const held: Held[] = [];
  const directorDelta = new Map<string, { sum: number; n: number }>();
  const castDelta = new Map<string, { sum: number; n: number }>();
  for (const [filmId, rating] of rated) {
    const f = libById.get(filmId);
    if (!f) continue;
    const delta = rating - mean;
    tally(directorDelta, f.director, delta);
    // Billing order, cut at six. Past the sixth name a credit is a day of
    // work, not a reason anybody chose the film.
    for (const c of (f.castNames ?? []).slice(0, 6)) tally(castDelta, c, delta);
    const v = vec(f.embedding);
    if (v) held.push({ filmId, title: f.title, rating, delta, v });
  }
  // The most opinionated films first, then cut. A film rated at their own mean
  // carries no direction and still costs a full comparison per candidate.
  held.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return {
    user,
    mean,
    held: held.slice(0, LIB_MAX),
    directorDelta,
    castDelta,
    neighbours,
    watchIds,
    ratedIds: new Set(rated.keys()),
  };
}

/* ------------------------------------------------------------------ *
 * Collaborative similarity
 * ------------------------------------------------------------------ */

/** Below this many films in common, agreement is a coincidence. */
const MIN_CORATED = 8;
/** Pulls a similarity computed on few films toward zero. */
const CORATED_PRIOR = 12;
/** How many taste neighbours to keep. Past this they are mostly noise. */
const MAX_NEIGHBOURS = 25;

/**
 * Who rates films the way this person does.
 *
 * Centred on each side, so this measures agreement about which films are
 * better rather than agreement about how to use a ten point scale. Two people
 * who both love Sicario and both shrug at Joker are neighbours even if one of
 * them never awards above 8 and the other never below 6.
 */
function neighboursOf(
  me: string,
  myMean: number,
  ratingsByUser: Map<string, Map<string, number>>,
  means: Map<string, { mean: number; n: number }>,
): { userId: string; sim: number; mean: number }[] {
  const mine = ratingsByUser.get(me);
  if (!mine) return [];
  const out: { userId: string; sim: number; mean: number }[] = [];

  for (const [userId, theirs] of ratingsByUser) {
    if (userId === me) continue;
    const theirMean = means.get(userId)?.mean;
    if (theirMean === undefined) continue;

    let num = 0;
    let da = 0;
    let db2 = 0;
    let n = 0;
    // Walk the smaller library; the intersection is the same either way.
    const [small, big] = mine.size <= theirs.size ? [mine, theirs] : [theirs, mine];
    const smallIsMine = small === mine;
    for (const [filmId, r] of small) {
      const other = big.get(filmId);
      if (other === undefined) continue;
      const x = (smallIsMine ? r : other) - myMean;
      const y = (smallIsMine ? other : r) - theirMean;
      num += x * y;
      da += x * x;
      db2 += y * y;
      n++;
    }
    if (n < MIN_CORATED || da === 0 || db2 === 0) continue;

    const cos = num / Math.sqrt(da * db2);
    if (cos <= 0) continue;
    out.push({ userId, sim: cos * (n / (n + CORATED_PRIOR)), mean: theirMean });
  }

  return out.sort((a, b) => b.sim - a.sim).slice(0, MAX_NEIGHBOURS);
}

/* ------------------------------------------------------------------ *
 * The five signals
 * ------------------------------------------------------------------ */

/** A reading, and how much the reading is worth. */
type Signal = { delta: number; conf: number };

const NONE: Signal = { delta: 0, conf: 0 };

/** How many of their own films vote on a candidate. */
const KNN = 12;
/** Below this cosine, two films are unrelated and a vote would be noise. */
const KNN_FLOOR = 0.32;

/**
 * What this person's own library says, locally.
 *
 * The important word is locally. A single taste vector averaged over a whole
 * library puts somebody who watches horror and Ghibli in the space between
 * them, which describes nobody and recommends the films nobody asked for.
 * Reading only the nearest dozen keeps each lobe of a lumpy taste intact:
 * a candidate near the horror lobe is judged by the horror films.
 *
 * The weight is the squared distance above the floor, which sharpens the
 * ranking so a 0.7 neighbour counts for far more than a 0.4 one rather than
 * marginally more.
 */
function contentSignal(p: Person, v: Float32Array): Signal & { pullers: Held[] } {
  const near: { h: Held; w: number }[] = [];
  for (const h of p.held) {
    const s = dot(v, h.v);
    if (s < KNN_FLOOR) continue;
    const w = (s - KNN_FLOOR) ** 2;
    near.push({ h, w });
  }
  if (near.length === 0) return { ...NONE, pullers: [] };

  near.sort((a, b) => b.w - a.w);
  const top = near.slice(0, KNN);
  let num = 0;
  let den = 0;
  for (const { h, w } of top) {
    num += w * h.delta;
    den += w;
  }
  return {
    delta: num / den,
    // Two strong neighbours is a real reading; one weak one is a guess.
    conf: Math.min(1, den / 0.35),
    // Only the films that actually pulled it in get named in the blurb.
    pullers: top.filter((t) => t.h.delta > 0).map((t) => t.h),
  };
}

/** What the people who rate like them thought. */
function collabSignal(
  p: Person,
  filmId: string,
  ratingsByUser: Map<string, Map<string, number>>,
): Signal & { raters: number; avg: number } {
  let num = 0;
  let den = 0;
  let raters = 0;
  let sum = 0;
  for (const nb of p.neighbours) {
    const r = ratingsByUser.get(nb.userId)?.get(filmId);
    if (r === undefined) continue;
    num += nb.sim * (r - nb.mean);
    den += nb.sim;
    sum += r;
    raters++;
  }
  if (den === 0) return { ...NONE, raters: 0, avg: 0 };
  return {
    delta: num / den,
    conf: Math.min(1, den / 1.2),
    raters,
    avg: sum / raters,
  };
}

/**
 * What everybody thought, relative to their own means.
 *
 * Weak on purpose and mostly redundant with the collaborative signal, but it
 * is the one that still works on the day somebody joins with no taste
 * neighbours yet, which is every new account.
 */
function crowdSignal(filmId: string, crowd: Map<string, { sum: number; n: number }>): Signal {
  const c = crowd.get(filmId);
  if (!c || c.n === 0) return NONE;
  return { delta: c.sum / (c.n + 4), conf: Math.min(1, c.n / 5) };
}

/**
 * What the critics thought, deliberately quiet.
 *
 * The whole premise of the product is that a critic average is not your
 * rating, so this is a tiebreaker between two films the personal signals like
 * equally, never a reason on its own. Each source is centred on its own
 * typical value, because a 62 on Rotten Tomatoes and a 62 on Metacritic are
 * not the same claim.
 */
function criticSignal(f: FilmRow): Signal {
  const parts: number[] = [];
  if (f.imdbRating != null) parts.push(f.imdbRating - 68);
  if (f.rtScore != null) parts.push(f.rtScore / 10 - 6.2);
  if (f.metacritic != null) parts.push(f.metacritic / 10 - 5.8);
  if (parts.length === 0) return NONE;
  const delta = parts.reduce((s, x) => s + x, 0) / parts.length;
  // Thin vote counts are how an obscure film ends up with a 9.1 average.
  const votes = Math.min(1, Math.log10((f.imdbVotes ?? 0) + 1) / 5);
  return { delta: delta * 0.7, conf: Math.min(1, 0.35 + 0.65 * votes) };
}

/** The names they keep coming back to, which embeddings blur. */
function peopleSignal(p: Person, f: FilmRow): Signal {
  const dirEntry = f.director ? p.directorDelta.get(f.director) : undefined;
  const dir = shrunk(dirEntry, 1.5);
  const dirConf = dirEntry ? Math.min(1, dirEntry.n / 2.5) : 0;

  let castSum = 0;
  let castN = 0;
  for (const c of f.castNames ?? []) {
    const e = p.castDelta.get(c);
    if (!e || e.n < 2) continue;
    castSum += shrunk(e, 2);
    castN++;
  }
  const cast = castN ? castSum / castN : 0;
  const castConf = castN ? Math.min(1, castN / 3) : 0;

  const conf = Math.max(dirConf, castConf);
  if (conf === 0) return NONE;
  // Blended by their own confidences so a known director is not diluted by an
  // unknown cast.
  const num = dir * dirConf + cast * castConf * 0.6;
  const den = dirConf + castConf * 0.6;
  return { delta: den ? num / den : 0, conf };
}

/** How much each signal is trusted when it is equally confident. */
const W = {
  content: 1.0,
  collab: 1.15,
  crowd: 0.4,
  critic: 0.3,
  people: 0.5,
};

type Prediction = {
  rating: number;
  conf: number;
  pullers: Held[];
  collabRaters: number;
  collabAvg: number;
  directorLoved: boolean;
};

/**
 * Their predicted rating, in tenths.
 *
 * Confidence weighted rather than fixed weighted, which is the part that
 * matters. A fixed blend quietly treats "no evidence" as "average", so a film
 * nothing knows anything about lands on the mean, and since most people's
 * means are high, unknown films float to the top of the list. Here a signal
 * that knows nothing contributes nothing, and the shortfall is carried out as
 * a low confidence that the pair score charges for separately.
 */
function predict(
  p: Person,
  f: FilmRow,
  v: Float32Array | null,
  ratingsByUser: Map<string, Map<string, number>>,
  crowd: Map<string, { sum: number; n: number }>,
): Prediction {
  const content = v ? contentSignal(p, v) : { ...NONE, pullers: [] as Held[] };
  const collab = collabSignal(p, f.id, ratingsByUser);
  const parts: [number, Signal][] = [
    [W.content, content],
    [W.collab, collab],
    [W.crowd, crowdSignal(f.id, crowd)],
    [W.critic, criticSignal(f)],
    [W.people, peopleSignal(p, f)],
  ];

  let num = 0;
  let den = 0;
  for (const [w, s] of parts) {
    num += w * s.conf * s.delta;
    den += w * s.conf;
  }
  const delta = den > 0 ? num / den : 0;
  // The two signals built from this person specifically. The crowd and the
  // critics agreeing about a film is not evidence that *they* will like it.
  const conf = Math.min(1, 0.65 * content.conf + 0.55 * collab.conf);

  const dirEntry = f.director ? p.directorDelta.get(f.director) : undefined;

  return {
    rating: Math.max(10, Math.min(100, Math.round(p.mean + delta))),
    conf,
    pullers: content.pullers,
    collabRaters: collab.raters,
    collabAvg: collab.avg,
    directorLoved: !!dirEntry && dirEntry.n >= 2 && shrunk(dirEntry, 1.5) > 2,
  };
}

/* ------------------------------------------------------------------ *
 * Joining two people
 * ------------------------------------------------------------------ */

/** How hard a lopsided pick is punished. One of you loving it is not enough. */
const FAIRNESS = 0.35;
/** What a film neither model has any handle on gives up, in tenths. */
const UNCERTAINTY = 9;
/** Being on a watchlist is stated intent, which no inference beats. */
const WANT_ONE = 3;
const WANT_BOTH = 7;
/** For a film each of them reaches through a different door. */
const BRIDGE = 2;
/** How much a candidate loses for resembling something already picked. */
const REDUNDANCY = 14;

type Scored = {
  film: FilmRow;
  v: Float32Array | null;
  a: Prediction;
  b: Prediction;
  score: number;
  bridge: boolean;
};

function joint(film: FilmRow, a: Prediction, b: Prediction, pa: Person, pb: Person, bridge: boolean): number {
  const onA = pa.watchIds.has(film.id);
  const onB = pb.watchIds.has(film.id);
  const want = onA && onB ? WANT_BOTH : onA || onB ? WANT_ONE : 0;
  const fair = 0.5 * (a.rating + b.rating) - FAIRNESS * Math.abs(a.rating - b.rating);
  const unknown = UNCERTAINTY * (1 - Math.min(a.conf, b.conf));
  return fair + want - unknown + (bridge ? BRIDGE : 0);
}

/**
 * Five films that are not the same film five times.
 *
 * Ranking alone returns a cluster, because whatever wins is surrounded by its
 * own neighbours in exactly the space that chose it. Each pick is charged for
 * how close it sits to what is already on the list, so the second slot has to
 * be good on its own terms rather than good by association with the first.
 */
function selectDiverse(scored: Scored[], n: number): Scored[] {
  const out: Scored[] = [];
  const byDirector = new Map<string, number>();
  const pool = [...scored].sort((x, y) => y.score - x.score);

  while (out.length < n && pool.length) {
    let bestI = -1;
    let best = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      const dir = c.film.director ?? "";
      if (dir && (byDirector.get(dir) ?? 0) >= 2) continue;
      let close = 0;
      if (c.v) {
        for (const o of out) if (o.v) close = Math.max(close, dot(c.v, o.v));
      }
      const adjusted = c.score - REDUNDANCY * close;
      if (adjusted > best) {
        best = adjusted;
        bestI = i;
      }
    }
    if (bestI === -1) break;
    const [picked] = pool.splice(bestI, 1);
    out.push(picked);
    const dir = picked.film.director ?? "";
    if (dir) byDirector.set(dir, (byDirector.get(dir) ?? 0) + 1);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Saying why
 * ------------------------------------------------------------------ */

function nameOf(u: SessionUser): string {
  return u.displayName ?? u.username;
}

/**
 * The sentence under a poster, built from the thing that actually chose it.
 *
 * Ordered by how much it tells a reader, and every rung names something they
 * can check: a film in their own diary, a count of people, a director. The old
 * fallback was "Widely loved, and close to films you both rate well", which is
 * what a recommender says when it cannot tell you why.
 */
type Reason = { kind: string; text: string; strength: number };

function reasonsFor(s: Scored, pa: Person, pb: Person): Reason[] {
  const f = s.film;
  const out: Reason[] = [];

  const onA = pa.watchIds.has(f.id);
  const onB = pb.watchIds.has(f.id);
  if (onA && onB) out.push({ kind: "want", text: "On both of your watchlists.", strength: 100 });
  else if (onA || onB) {
    out.push({ kind: "want", text: `Already on ${nameOf(onA ? pa.user : pb.user)}'s watchlist.`, strength: 90 });
  }

  const topA = s.a.pullers[0];
  const topB = s.b.pullers[0];
  if (topA && topB && topA.filmId === topB.filmId) {
    out.push({ kind: "shared", text: `Close to ${topA.title}, which you have both rated well.`, strength: 80 });
  } else if (topA && topB) {
    out.push({
      kind: "bridge",
      text: `Close to your ${topA.title} and ${nameOf(pb.user)}'s ${topB.title}.`,
      strength: 70,
    });
  } else if (topA || topB) {
    const who = topA ? "your" : `${nameOf(pb.user)}'s`;
    out.push({ kind: "one", text: `Close to ${(topA ?? topB)!.title} in ${who} diary.`, strength: 55 });
  }

  const raters = Math.max(s.a.collabRaters, s.b.collabRaters);
  if (raters >= 3) {
    const avg = s.a.collabRaters >= s.b.collabRaters ? s.a.collabAvg : s.b.collabAvg;
    const whose = s.a.collabRaters >= s.b.collabRaters ? "you" : nameOf(pb.user);
    out.push({
      kind: "people",
      text: `${raters} people who rate films the way ${whose === "you" ? "you do" : `${whose} does`} gave it ${(avg / 10).toFixed(1)}.`,
      strength: 40 + Math.min(20, raters),
    });
  }

  if (f.director && (s.a.directorLoved || s.b.directorLoved)) {
    const who =
      s.a.directorLoved && s.b.directorLoved ? "both of you" : nameOf(s.a.directorLoved ? pa.user : pb.user);
    out.push({ kind: "director", text: `Directed by ${f.director}, who rates highly with ${who}.`, strength: 60 });
  }

  const second = s.a.pullers[1] ?? s.b.pullers[1];
  if (second) {
    out.push({ kind: "second", text: `Sits between ${second.title} and the rest of what you both watch.`, strength: 30 });
  }

  if (f.director) out.push({ kind: "plain", text: `Directed by ${f.director}.`, strength: 10 });
  out.push({ kind: "plain", text: "Close to the overlap between your two libraries.", strength: 1 });

  return out.sort((x, y) => y.strength - x.strength);
}

/**
 * The strongest reason each film has that the list is not already using.
 *
 * Every one of the five reaching for its single best sentence produced five
 * copies of the same sentence, because whatever template wins for one film
 * usually wins for all of them. A reader learns nothing from the fourth
 * "close to your X and their Y", so a template that has already been spent
 * steps aside for the next reason down, as long as one exists.
 */
function assignBlurbs(picked: Scored[], pa: Person, pb: Person): string[] {
  const used = new Set<string>();
  return picked.map((s) => {
    const reasons = reasonsFor(s, pa, pb);
    const fresh = reasons.find((r) => !used.has(r.kind) && r.kind !== "plain");
    const chosen = fresh ?? reasons[0];
    used.add(chosen.kind);
    return chosen.text;
  });
}

/* ------------------------------------------------------------------ *
 * Retrieval
 * ------------------------------------------------------------------ */

/** The ceiling on how many films get scored. */
const POOL = 700;
/** How many of each person's favourites are walked outward from. */
const SEEDS = 30;

/**
 * Builds the pool around this pair rather than around the catalogue.
 *
 * Four doors, in order of how much they know about these two people:
 * the neighbours of films they love, the films their taste neighbours love,
 * their watchlists, and finally a popularity backfill so a thin library still
 * gets five answers. The neighbour lists were computed overnight, so the first
 * and largest door costs one indexed read and no vector maths at all.
 */
async function retrieve(
  libA: FilmRow[],
  libB: FilmRow[],
  ratedA: Map<string, number>,
  ratedB: Map<string, number>,
  neighbourIds: string[],
  watchIds: Set<string>,
  exclude: Set<string>,
): Promise<FilmRow[]> {
  const seedSlugs = new Set<string>();
  for (const [lib, rated] of [
    [libA, ratedA],
    [libB, ratedB],
  ] as const) {
    const loved = lib
      .filter((f) => (rated.get(f.id) ?? 0) >= STRONG_TENTHS)
      .sort((x, y) => (rated.get(y.id) ?? 0) - (rated.get(x.id) ?? 0))
      .slice(0, SEEDS);
    for (const f of loved) for (const s of f.similarFilms ?? []) seedSlugs.add(s.slug);
  }

  const ids = new Set<string>(watchIds);

  if (seedSlugs.size) {
    const rows = await db
      .select({ id: films.id })
      .from(films)
      .where(inArray(films.slug, [...seedSlugs]));
    for (const r of rows) ids.add(r.id);
  }

  // What the taste neighbours rated highly and this pair has not seen.
  if (neighbourIds.length) {
    const rows = await db.execute(sql`
      select distinct on (user_id, film_id) film_id
      from diary_entries
      where rating >= ${STRONG_TENTHS}
        and user_id in ${sql`(${sql.join(neighbourIds.map((id) => sql`${id}::uuid`), sql`, `)})`}
      order by user_id, film_id, watched_on desc nulls last, created_at desc
    `);
    for (const r of rows as unknown as { film_id: string }[]) ids.add(r.film_id);
  }

  for (const id of exclude) ids.delete(id);

  let pool: FilmRow[] = [];
  if (ids.size) {
    pool = (await db
      .select(filmCols)
      .from(films)
      .where(
        and(
          inArray(films.id, [...ids].slice(0, POOL * 2)),
          sql`${films.posterPath} is not null`,
          sql`${films.embedding} is not null`,
        ),
      )) as FilmRow[];
  }

  // A backfill, so a pair with two small libraries is never handed nothing.
  if (pool.length < POOL) {
    const have = new Set(pool.map((f) => f.id));
    const extra = (await db
      .select(filmCols)
      .from(films)
      .where(and(sql`${films.posterPath} is not null`, sql`${films.embedding} is not null`))
      .orderBy(sql`${films.popularity} desc nulls last`)
      .limit(POOL)) as FilmRow[];
    for (const f of extra) {
      if (pool.length >= POOL) break;
      if (have.has(f.id) || exclude.has(f.id)) continue;
      pool.push(f);
    }
  }

  return pool.slice(0, POOL);
}

/* ------------------------------------------------------------------ *
 * Entry points
 * ------------------------------------------------------------------ */

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

  // ---- what the pair has rated, and what everyone's baseline is
  const pairRatings = await db.execute(sql`
    select distinct on (user_id, film_id) user_id, film_id, rating
    from diary_entries
    where rating is not null and user_id in (${a.id}::uuid, ${b.id}::uuid)
    order by user_id, film_id, watched_on desc nulls last, created_at desc
  `);
  const ratedA = new Map<string, number>();
  const ratedB = new Map<string, number>();
  for (const r of pairRatings as unknown as { user_id: string; film_id: string; rating: number }[]) {
    (r.user_id === a.id ? ratedA : ratedB).set(r.film_id, r.rating);
  }

  const means = await meansByUser();
  const meanA = means.get(a.id)?.mean ?? 70;
  const meanB = means.get(b.id)?.mean ?? 70;

  const libIds = [...new Set([...ratedA.keys(), ...ratedB.keys()])];
  const libRows = (await db.select(filmCols).from(films).where(inArray(films.id, libIds))) as FilmRow[];
  const libById = new Map(libRows.map((f) => [f.id, f]));

  // ---- taste neighbours, measured over what this pair has actually rated
  const overLib = await currentRatingsFor(libIds);
  const ratingsByUser = new Map<string, Map<string, number>>();
  for (const r of overLib) {
    let m = ratingsByUser.get(r.userId);
    if (!m) ratingsByUser.set(r.userId, (m = new Map()));
    m.set(r.filmId, r.rating);
  }
  const nbA = neighboursOf(a.id, meanA, ratingsByUser, means);
  const nbB = neighboursOf(b.id, meanB, ratingsByUser, means);

  // ---- everything either of them has already dealt with
  const exclude = new Set<string>([...ratedA.keys(), ...ratedB.keys()]);
  const seenRows = await db
    .select({ filmId: diaryEntries.filmId })
    .from(diaryEntries)
    .where(inArray(diaryEntries.userId, [a.id, b.id]));
  for (const r of seenRows) exclude.add(r.filmId);
  const flagRows = await db
    .select({ filmId: userFilmFlags.filmId })
    .from(userFilmFlags)
    .where(inArray(userFilmFlags.userId, [a.id, b.id]));
  for (const r of flagRows) exclude.add(r.filmId);

  const wlRows = await db
    .select({ userId: watchlist.userId, filmId: watchlist.filmId })
    .from(watchlist)
    .where(inArray(watchlist.userId, [a.id, b.id]));
  const watchA = new Set(wlRows.filter((w) => w.userId === a.id).map((w) => w.filmId));
  const watchB = new Set(wlRows.filter((w) => w.userId === b.id).map((w) => w.filmId));
  const wantedIds = new Set([...watchA, ...watchB].filter((id) => !exclude.has(id)));

  // ---- the pool
  const neighbourIds = [...new Set([...nbA, ...nbB].map((n) => n.userId))];
  const pool = await retrieve(
    libRows.filter((f) => ratedA.has(f.id)),
    libRows.filter((f) => ratedB.has(f.id)),
    ratedA,
    ratedB,
    neighbourIds,
    wantedIds,
    exclude,
  );
  if (pool.length === 0) return { eligible: true, films: [] };

  // ---- ratings over the pool, for the collaborative signal and the crowd prior
  const poolRatings = await currentRatingsFor(pool.map((f) => f.id));
  for (const r of poolRatings) {
    let m = ratingsByUser.get(r.userId);
    if (!m) ratingsByUser.set(r.userId, (m = new Map()));
    m.set(r.filmId, r.rating);
  }
  const crowd = new Map<string, { sum: number; n: number }>();
  for (const r of poolRatings) {
    const mu = means.get(r.userId)?.mean;
    if (mu === undefined) continue;
    const c = crowd.get(r.filmId) ?? { sum: 0, n: 0 };
    c.sum += r.rating - mu;
    c.n += 1;
    crowd.set(r.filmId, c);
  }

  // ---- each person's model
  const pa = buildPerson(a, meanA, ratedA, libById, nbA, watchA);
  const pb = buildPerson(b, meanB, ratedB, libById, nbB, watchB);

  // ---- rotation: what this pair has already been shown
  const key = pairKey(a.id, b.id);
  const shownRows = await db
    .select({ filmId: recEvents.filmId })
    .from(recEvents)
    .where(and(eq(recEvents.pairKey, key), eq(recEvents.event, "shown")));
  let shown = new Set(shownRows.map((r) => r.filmId));
  let candidates = pool.filter((f) => !shown.has(f.id));
  if (candidates.length < PICKS && shown.size > 0) {
    await db.delete(recEvents).where(and(eq(recEvents.pairKey, key), eq(recEvents.event, "shown")));
    shown = new Set();
    candidates = pool;
  }

  // ---- score
  const scored: Scored[] = candidates.map((film) => {
    const v = vec(film.embedding);
    const predA = predict(pa, film, v, ratingsByUser, crowd);
    const predB = predict(pb, film, v, ratingsByUser, crowd);
    const bridge =
      !!predA.pullers[0] && !!predB.pullers[0] && predA.pullers[0].filmId !== predB.pullers[0].filmId;
    return {
      film,
      v,
      a: predA,
      b: predB,
      score: joint(film, predA, predB, pa, pb, bridge),
      bridge,
    };
  });

  const picked = selectDiverse(scored, PICKS);
  const blurbs = assignBlurbs(picked, pa, pb);

  if (picked.length) {
    await db
      .insert(recEvents)
      .values(picked.map((s) => ({ pairKey: key, filmId: s.film.id, event: "shown" })));
  }

  return {
    eligible: true,
    films: picked.map((s, i) => ({
      filmId: s.film.id,
      slug: s.film.slug,
      tmdbId: s.film.tmdbId,
      title: s.film.title,
      year: s.film.year,
      posterPath: s.film.posterPath,
      director: s.film.director,
      blurb: blurbs[i],
      predicted: [
        { username: a.username, rating: s.a.rating },
        { username: b.username, rating: s.b.rating },
      ],
    })),
  };
}

/**
 * The internals, for `scripts/eval-recs.ts` and nothing else.
 *
 * A model whose accuracy nobody has measured is a model nobody can defend, and
 * the only way to measure this one is to hold ratings back and predict them.
 * That needs the pieces rather than the finished endpoint, so they are exported
 * here under a name that makes clear they are not part of the surface.
 */
export const __model = {
  buildPerson,
  neighboursOf,
  predict,
  meansByUser,
  currentRatingsFor,
  filmCols,
  vec,
  /** Mutable so the evaluation can switch a signal off and see what it was worth. */
  W,
};
export type { FilmRow as EvalFilmRow, Person as EvalPerson };
