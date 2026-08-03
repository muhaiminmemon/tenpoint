// Gives every film a position on a map where similar films sit near each other.
//
// The themes are forty-three hand-authored buckets. They work when TMDB's
// keywords are good and fail silently when they are not: twenty-seven films in
// the catalogue match no bucket at all, Whiplash among them, so nothing in the
// product can tell that it resembles Black Swan. A bucket answers "same box or
// not". This answers "how far apart", for every film, including the ones the
// buckets miss.
//
// The model runs here and only here. The app reads numbers out of a column and
// does arithmetic, so nothing large is ever loaded inside the web server.
//
// Usage:
//   node scripts/backfill-embeddings.mjs           # every film without one
//   node scripts/backfill-embeddings.mjs --limit 50
//   node scripts/backfill-embeddings.mjs --all     # redo everything
//
// First run downloads about 25MB of model weights and caches them.

import "./load-env.mjs";
import postgres from "postgres";
import { pipeline, env } from "@xenova/transformers";

env.allowLocalModels = false;
/**
 * Somewhere writable to keep the model weights.
 *
 * The library caches about 25MB on first use and re-downloads it on every cold
 * container otherwise. A scheduled run on a host with a read-only project
 * directory fails here, before a single film is embedded, which looks from the
 * outside exactly like the job never ran.
 */
env.cacheDir = process.env.TRANSFORMERS_CACHE || "/tmp/transformers-cache";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number.parseInt(process.argv[i + 1] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};

const LIMIT = arg("limit", 0) || 1_000_000;
const ALL = process.argv.includes("--all");
/**
 * A wall-clock budget, so a scheduled run ends on its own terms.
 *
 * Production stalled at 512 of 574 films and stayed there for two nights: a
 * clean stop on a batch boundary, which is what being killed looks like rather
 * than what crashing looks like. Every film is written as it is embedded, so a
 * killed run keeps its work either way, but stopping deliberately means the
 * job reports what is left instead of dying mid-sentence and looking fine.
 */
const MINUTES = arg("minutes", 0) || 25;

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set.");
const sql = postgres(DATABASE_URL);

/**
 * What the model reads.
 *
 * Keywords first because they are the most reliable field we hold, present on
 * 99% of the catalogue where the overview is on 65%. Genre, director and the
 * billed cast follow, because a film is partly who made it. The overview goes
 * last and only when it exists, since marketing copy describes how a film was
 * sold more than what it is.
 */
function describe(f) {
  const parts = [
    f.title,
    (f.genres ?? []).join(", "),
    (f.keywords ?? []).slice(0, 20).join(", "),
    f.director ? `Directed by ${f.director}` : "",
    (f.cast_names ?? []).slice(0, 5).join(", "),
    f.year ? `${f.year}` : "",
    f.overview && f.overview.length > 40 ? f.overview.slice(0, 400) : "",
  ];
  return parts.filter(Boolean).join(". ");
}

const rows = ALL
  ? await sql`
      select id, title, genres, keywords, director, cast_names, year, overview
      from films order by popularity desc nulls last limit ${LIMIT}`
  : await sql`
      select id, title, genres, keywords, director, cast_names, year, overview
      from films where embedding is null
      order by popularity desc nulls last limit ${LIMIT}`;

const [{ pending }] = ALL
  ? [{ pending: rows.length }]
  : await sql`select count(*)::int as pending from films where embedding is null`;

console.log(`\n  ${rows.length} films to embed.`);
if (pending > rows.length) {
  console.log(`  (${pending - rows.length} more are waiting; run again to continue.)`);
}

if (rows.length === 0) {
  await sql.end();
  process.exit(0);
}

console.log("  loading the model (first run downloads it)...\n");
const embed = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

const deadline = Date.now() + MINUTES * 60_000;
let done = 0;
let ranOut = false;
// Batched because the round trip dominates: the model handles a handful at a
// time far faster than one at a time, and the database likes fewer statements.
const BATCH = 16;
for (let i = 0; i < rows.length; i += BATCH) {
  if (Date.now() > deadline) {
    ranOut = true;
    break;
  }
  const batch = rows.slice(i, i + BATCH);
  const out = await embed(batch.map(describe), { pooling: "mean", normalize: true });
  const dim = out.dims[out.dims.length - 1];

  for (let k = 0; k < batch.length; k++) {
    const vec = Array.from(out.data.slice(k * dim, (k + 1) * dim)).map(
      // Four decimals is far beyond what cosine distance can distinguish here,
      // and it keeps the stored rows a third of the size.
      (v) => Math.round(v * 10_000) / 10_000,
    );
    await sql`update films set embedding = ${sql.json(vec)} where id = ${batch[k].id}`;
    done++;
  }
  process.stdout.write(`\r  ${done}/${rows.length} embedded`);
}

const [totals] = await sql`
  select count(*)::int total, count(embedding)::int with_embedding from films`;
console.log(`\n\n  catalogue: ${totals.total} films`);
console.log(`  with an embedding: ${totals.with_embedding}`);
const left = totals.total - totals.with_embedding;
if (ranOut) {
  console.log(`\n  stopped after ${MINUTES} minutes with ${left} still to do. Run again to continue.`);
} else if (left > 0) {
  console.log(`\n  ${left} films could not be embedded.`);
}
console.log();

await sql.end();
