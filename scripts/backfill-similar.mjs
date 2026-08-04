// Works out which films sit next to which, once, so no page view has to.
//
// Scoring one film against four hundred candidates means reading about a
// megabyte of vectors. That is nothing overnight and unacceptable on every
// visit to a film page, so the answer is computed here and stored as a dozen
// slugs with the real overlap behind each.
//
// The ranking is the similarity map, which is good at this: Interstellar comes
// back with The Martian, Prometheus, Arrival and Dune. The *reason* printed
// under each one is never the model, always a fact the reader could check for
// themselves. A number that only a cosine could explain has no business on a
// page that refuses to show scores.
//
// Usage:
//   node scripts/backfill-similar.mjs          # films without a list yet
//   node scripts/backfill-similar.mjs --all    # recompute everything
//
// Run it after the embeddings job; it reads what that writes.

import "./load-env.mjs";
import postgres from "postgres";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number.parseInt(process.argv[i + 1] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};

const LIMIT = arg("limit", 0) || 1_000_000;
const ALL = process.argv.includes("--all");

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set.");
const sql = postgres(DATABASE_URL);

/** How many to store. The page shows fewer; the surplus absorbs the films a viewer has already seen. */
const KEEP = 12;
/**
 * Above this, two films are the same film twice.
 *
 * Measured on the catalogue: sequel pairs land between 0.75 and 0.88, so a
 * rail ranked on raw similarity returns Ice Age, Ice Age: The Meltdown and
 * Ice Age: Dawn of the Dinosaurs. Somebody looking at Ice Age knows the
 * sequels exist. The interesting band is the one underneath.
 */
const SAME_FILM = 0.8;
/** Two by one director is a taste; four is a filmography, and a worse rail. */
const MAX_PER_DIRECTOR = 2;

/**
 * The other kind of same film, which similarity alone does not catch.
 *
 * The Harry Potter films have five different directors and sit below the
 * cosine cut, so nothing stopped the rail on Goblet of Fire being the other
 * five Harry Potter films. What actually gives a series away is that it keeps
 * the same people: three shared faces is a cast, not a coincidence. A shared
 * opening to the title catches the rest.
 */
const SERIES_CAST = 3;

const words = (t) =>
  t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);

function sameSeries(a, b, sharedCast) {
  if (sharedCast >= SERIES_CAST) return true;
  const x = words(a.title);
  const y = words(b.title);
  let same = 0;
  while (same < x.length && same < y.length && x[same] === y[same]) same++;
  // Two opening words in common is "Harry Potter" or "Star Wars", not an
  // accident. One is "The".
  return same >= 2;
}

const cos = (a, b) => {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d;
};

const overlap = (a = [], b = []) => {
  const set = new Set((b ?? []).map((x) => String(x).toLowerCase()));
  return (a ?? []).filter((x) => set.has(String(x).toLowerCase()));
};

/**
 * Keywords that are not a reason.
 *
 * A shared setting is not a shared subject: "The Fate of the Furious, both
 * about new york city" was a sentence this produced, and it reads as the
 * system reaching. Places carry a comma or the word city in TMDB's vocabulary,
 * and the rest are production facts or sentiment tags.
 */
const NOT_A_REASON = new Set([
  "woman director", "sequel", "prequel", "reboot", "remake", "spin off",
  "duringcreditsstinger", "aftercreditsstinger", "based on novel or book",
  "based on comic", "based on true story", "3d animation", "live action and animation",
  "cartoon", "anime", "violence", "flashback", "montage", "voice over",
]);
const isReason = (k) => !NOT_A_REASON.has(k) && !k.includes(",") && !/\bcity\b/.test(k);

/**
 * The sentence under a poster. Concrete, or the film does not appear.
 *
 * Ordered by how much it tells somebody: the same director is the strongest
 * claim, a shared face is next, then what the two films are actually about.
 * There is deliberately no weak final rung. "Also thriller" and "both about
 * new york city" were both produced by one, and a poster carrying a reason
 * that thin is worse than one fewer poster.
 */
function reasonFor(film, other, faces) {
  if (film.director && other.director && film.director === other.director) {
    // A season stores its show's creator in the same column a film stores its
    // director, which is right for searching and wrong to print: nobody
    // directs a series, and "also directed by Vince Gilligan" under Better
    // Call Saul is a claim the page cannot support.
    const madeBy =
      film.kind === "season" || other.kind === "season" ? "Also created by" : "Also directed by";
    return `${madeBy} ${film.director}`;
  }
  if (faces.length >= 2) return `With ${faces[0]} and ${faces[1]}`;
  if (faces.length === 1) return `With ${faces[0]}`;

  const shared = overlap(film.keywords, other.keywords).filter(isReason);
  if (shared.length >= 2) return `Shares ${shared.slice(0, 3).join(", ")}`;

  const genres = overlap(film.genres, other.genres);
  const decade =
    film.year && other.year && Math.floor(film.year / 10) === Math.floor(other.year / 10);
  if (genres.length >= 2 && decade) {
    return `${genres[0]} and ${genres[1]}, both from the ${Math.floor(film.year / 10) * 10}s`;
  }
  if (shared.length === 1 && genres.length >= 1) {
    return `${genres[0]}, both about ${shared[0]}`;
  }
  return null;
}

const targets = ALL
  ? await sql`
      select id, slug, title, year, kind, genres, keywords, director, cast_names, embedding
      from films where embedding is not null
      order by popularity desc nulls last limit ${LIMIT}`
  : await sql`
      select id, slug, title, year, kind, genres, keywords, director, cast_names, embedding
      from films where embedding is not null and similar_films is null
      order by popularity desc nulls last limit ${LIMIT}`;

console.log(`\n  ${targets.length} films to place.\n`);
if (targets.length === 0) {
  await sql.end();
  process.exit(0);
}

// Every film with a vector, held once. The whole catalogue is a few thousand
// rows; re-reading candidates per film would be the same work a thousand times.
const all = await sql`
  select id, slug, title, year, kind, genres, keywords, director, cast_names, embedding
  from films where embedding is not null`;
console.log(`  comparing against ${all.length} embedded films.\n`);

let done = 0;
for (const film of targets) {
  const scored = [];
  for (const other of all) {
    if (other.id === film.id) continue;
    const base = cos(film.embedding, other.embedding);
    if (base >= SAME_FILM) continue;

    const faces = overlap(film.cast_names, other.cast_names);
    if (sameSeries(film, other, faces.length)) continue;

    let score = base;
    if (film.director && other.director && film.director === other.director) score += 0.25;
    score += Math.min(0.2, faces.length * 0.1);
    score += Math.min(0.14, overlap(film.keywords, other.keywords).length * 0.02);
    if (film.year && other.year && Math.floor(film.year / 10) === Math.floor(other.year / 10)) {
      score += 0.05;
    }
    scored.push({ other, score, faces });
  }

  scored.sort((a, b) => b.score - a.score);

  const out = [];
  const perDirector = new Map();
  for (const { other, faces } of scored) {
    if (out.length >= KEEP) break;
    const d = other.director ?? "";
    if (d && (perDirector.get(d) ?? 0) >= MAX_PER_DIRECTOR) continue;
    const why = reasonFor(film, other, faces);
    // No checkable reason means no tile. A poster with nothing under it is the
    // thing this rail exists to not be.
    if (!why) continue;
    if (d) perDirector.set(d, (perDirector.get(d) ?? 0) + 1);
    out.push({ slug: other.slug, why });
  }

  await sql`update films set similar_films = ${sql.json(out)} where id = ${film.id}`;
  done++;
  if (done % 25 === 0) process.stdout.write(`\r  ${done}/${targets.length} placed`);
}

const [totals] = await sql`
  select count(*)::int total, count(similar_films)::int with_similar,
         count(*) filter (where jsonb_array_length(similar_films) >= 6)::int usable
  from films`;
console.log(`\r  ${done}/${targets.length} placed\n`);
console.log(`  catalogue: ${totals.total} films`);
console.log(`  with a list: ${totals.with_similar}, of which ${totals.usable} have six or more\n`);

await sql.end();
