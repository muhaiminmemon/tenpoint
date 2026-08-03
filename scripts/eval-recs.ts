// Does the recommender actually know anything?
//
// Every recommender looks good when you read its output, because you read it
// looking for the films that fit. The only honest test is to hide ratings that
// already exist, predict them, and check the answer against what the person
// actually said.
//
// Protocol: every account with enough history has a fifth of its ratings held
// out, chosen by a hash of the film id so the split is identical between runs
// and between models. The model is rebuilt from the remaining four fifths, and
// the held-out films are both predicted and ranked. Nothing about the held-out
// ratings reaches the taste-neighbour search or the crowd prior, which is the
// leak that makes offline numbers look wonderful and online results feel
// random.
//
// Reported side by side:
//   mean       predict this person's own average for everything
//   crowd      predict what everyone else thought, centred
//   counts     the bag-of-counts scorer this recommender replaced
//   model      the current model
//
// MAE is in tenths, so 8.0 means the average prediction is 0.8 out.
// Hit@5 is how often a film in the top five predicted is one they went on to
// rate 8.0 or better, against the base rate of doing it by chance.
//
// Usage:
//   npx tsx scripts/eval-recs.ts

import "./load-env.mjs";
import { db } from "../src/db";
import { films } from "../src/db/schema";
import { __model, type EvalFilmRow } from "../src/lib/recs";
import type { SessionUser } from "../src/db/schema";

const { buildPerson, neighboursOf, predict, meansByUser, vec, filmCols } = __model;

/** Held-out share, by a stable hash rather than a shuffle. */
const HOLDOUT = 5;
/** Below this an account has too little history to split. */
const MIN_HISTORY = 25;
/** What counts as a film they were glad they watched. */
const LOVED = 80;

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % HOLDOUT;
};

/* ------------------------------------------------------------------ *
 * The scorer this replaced, kept only so the comparison is real.
 * ------------------------------------------------------------------ */

function countsModel(train: Map<string, number>, byId: Map<string, EvalFilmRow>, mean: number) {
  const g = new Map<string, number>();
  const d = new Map<string, number>();
  const dec = new Map<string, number>();
  const cast = new Map<string, number>();
  const kw = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string | null | undefined, w: number) => {
    if (!k) return;
    m.set(k, (m.get(k) ?? 0) + w);
  };
  const decadeOf = (y: number | null) => (y ? `${Math.floor(y / 10) * 10}s` : null);

  for (const [id, rating] of train) {
    const f = byId.get(id);
    if (!f) continue;
    const w = (rating - mean) / 10;
    for (const x of f.genres ?? []) bump(g, x, w);
    bump(dec, decadeOf(f.year), w);
    if (w > 0) {
      bump(d, f.director, w);
      for (const c of f.castNames ?? []) bump(cast, c, w);
      for (const k of (f as unknown as { keywords: string[] | null }).keywords ?? []) bump(kw, k, w);
    }
  }
  for (const m of [g, d, dec, cast, kw]) {
    let max = 0;
    for (const v of m.values()) max = Math.max(max, Math.abs(v));
    if (max) for (const [k, v] of m) m.set(k, v / max);
  }

  return (f: EvalFilmRow) => {
    const genres = f.genres ?? [];
    const gs = genres.length ? genres.reduce((s, x) => s + (g.get(x) ?? 0), 0) / genres.length : 0;
    const ds = f.director ? (d.get(f.director) ?? 0) : 0;
    const decs = dec.get(decadeOf(f.year) ?? "") ?? 0;
    const cs = f.castNames?.length
      ? f.castNames.reduce((s, c) => s + (cast.get(c) ?? 0), 0) / f.castNames.length
      : 0;
    const keys = (f as unknown as { keywords: string[] | null }).keywords ?? [];
    const ks = keys.length ? keys.reduce((s, k) => s + (kw.get(k) ?? 0), 0) / keys.length : 0;
    return 1.6 * gs + 1.4 * ds + 0.7 * decs + 0.6 * cs + 0.6 * ks;
  };
}

/* ------------------------------------------------------------------ */

/**
 * One pass over every held-out rating. Returns the two numbers that matter,
 * plus the baselines, which are recomputed each time and cost nothing.
 */
type Pass = { mae: number; hit: number; maeMean: number; maeCrowd: number; hitCounts: number; hitBase: number; n: number; diaries: number };

async function main() {
  console.log("\n  loading catalogue and diaries...\n");

  const filmRows = (await db
    .select({ ...filmCols, keywords: films.keywords })
    .from(films)) as unknown as EvalFilmRow[];
  const byId = new Map(filmRows.map((f) => [f.id, f]));

  const means = await meansByUser();
  const all = await __model.currentRatingsFor(filmRows.map((f) => f.id));

  const byUser = new Map<string, Map<string, number>>();
  for (const r of all) {
    let m = byUser.get(r.userId);
    if (!m) byUser.set(r.userId, (m = new Map()));
    m.set(r.filmId, r.rating);
  }

  const eligible = [...byUser.entries()].filter(([, m]) => m.size >= MIN_HISTORY);
  console.log(`  ${filmRows.length} films, ${byUser.size} diaries, ${eligible.length} large enough to split\n`);
  if (eligible.length === 0) {
    console.log("  nothing to evaluate.\n");
    await close();
    return;
  }

  const run = (): Pass => {
    const err = { mean: [] as number[], crowd: [] as number[], model: [] as number[] };
    const hit = { counts: 0, model: 0, base: 0, n: 0 };

    for (const [userId, ratings] of eligible) {
      const mean = means.get(userId)?.mean ?? 70;

      const train = new Map<string, number>();
      const test = new Map<string, number>();
      for (const [filmId, r] of ratings) (hash(filmId) === 0 ? test : train).set(filmId, r);
      if (test.size < 5 || train.size < 15) continue;

      // The world as it would look if this person had never rated the held-out
      // films. Anything less is the model grading its own homework.
      const trainWorld = new Map(byUser);
      trainWorld.set(userId, train);

      const crowd = new Map<string, { sum: number; n: number }>();
      for (const [otherId, m] of trainWorld) {
        const mu = means.get(otherId)?.mean;
        if (mu === undefined) continue;
        for (const [filmId, r] of m) {
          const c = crowd.get(filmId) ?? { sum: 0, n: 0 };
          c.sum += r - mu;
          c.n += 1;
          crowd.set(filmId, c);
        }
      }

      const nb = neighboursOf(userId, mean, trainWorld, means);
      const person = buildPerson(
        { id: userId, username: "eval", displayName: null } as unknown as SessionUser,
        mean,
        train,
        byId,
        nb,
        new Set(),
      );

      const counts = countsModel(train, byId, mean);
      const scored: { truth: number; model: number; counts: number }[] = [];

      for (const [filmId, truth] of test) {
        const f = byId.get(filmId);
        if (!f) continue;
        const p = predict(person, f, vec(f.embedding), trainWorld, crowd);

        err.mean.push(Math.abs(truth - mean));
        const c = crowd.get(filmId);
        const crowdPred = c && c.n > 0 ? mean + c.sum / (c.n + 4) : mean;
        err.crowd.push(Math.abs(truth - crowdPred));
        err.model.push(Math.abs(truth - p.rating));

        scored.push({ truth, model: p.rating, counts: counts(f) });
      }

      if (scored.length >= 5) {
        const top = (key: "model" | "counts") =>
          [...scored].sort((x, y) => y[key] - x[key]).slice(0, 5).filter((s) => s.truth >= LOVED).length / 5;
        hit.model += top("model");
        hit.counts += top("counts");
        hit.base += scored.filter((s) => s.truth >= LOVED).length / scored.length;
        hit.n++;
      }
    }

    const mae = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
    const d = Math.max(1, hit.n);
    return {
      mae: mae(err.model),
      maeMean: mae(err.mean),
      maeCrowd: mae(err.crowd),
      hit: hit.model / d,
      hitCounts: hit.counts / d,
      hitBase: hit.base / d,
      n: err.model.length,
      diaries: hit.n,
    };
  };

  const full = run();
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  console.log(`  held out ${full.n} ratings from ${full.diaries} diaries`);
  console.log(`\n  mean absolute error, in tenths (lower is better)`);
  console.log(`    predict their own mean   ${full.maeMean.toFixed(2)}`);
  console.log(`    predict the crowd        ${full.maeCrowd.toFixed(2)}`);
  console.log(`    this model               ${full.mae.toFixed(2)}`);
  console.log(`\n    ${((1 - full.mae / full.maeMean) * 100).toFixed(1)}% better than assuming everyone is average to them.`);

  console.log(`\n  top five picks that turned out to be ${(LOVED / 10).toFixed(1)} or better (higher is better)`);
  console.log(`    by chance                ${pct(full.hitBase)}`);
  console.log(`    bag of counts            ${pct(full.hitCounts)}`);
  console.log(`    this model               ${pct(full.hit)}`);

  // What each signal is worth: switch it off and see what breaks. A signal
  // that costs nothing to remove is a signal that should not be in the blend.
  console.log(`\n  with one signal switched off`);
  const W = __model.W;
  const keys = Object.keys(W) as (keyof typeof W)[];
  for (const k of keys) {
    const keep = W[k];
    W[k] = 0;
    const r = run();
    W[k] = keep;
    const dMae = r.mae - full.mae;
    const dHit = r.hit - full.hit;
    console.log(
      `    without ${k.padEnd(8)} MAE ${r.mae.toFixed(2)} (${dMae >= 0 ? "+" : ""}${dMae.toFixed(2)})   hit@5 ${pct(r.hit)} (${dHit >= 0 ? "+" : ""}${(dHit * 100).toFixed(1)})`,
    );
  }
  console.log();

  await close();
}

async function close() {
  const client = (db as unknown as { $client?: { end?: () => Promise<void> } }).$client;
  await client?.end?.();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
