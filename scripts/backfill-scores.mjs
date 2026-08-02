// Fills the catalogue with IMDb / Rotten Tomatoes scores so the critic
// leaderboards have something to rank.
//
// TMDB holds no IMDb or Tomatometer data at all, and OMDb answers one film per
// request with a 1,000/day ceiling on the free tier, so a leaderboard cannot be
// computed on demand — it has to be a table that already exists. This builds
// that table.
//
// Resumable and rate-aware by design: it stops the moment OMDb refuses, records
// nothing twice, and can simply be run again tomorrow. Each pass:
//   1. pulls the most-voted films from TMDB and inserts any it has not seen,
//   2. fills in missing imdb_ids from TMDB (no daily limit worth minding),
//   3. spends the remaining OMDb budget on films with no scores yet.
//
// Usage:
//   node scripts/backfill-scores.mjs                 # default: up to 100k OMDb calls
//   node scripts/backfill-scores.mjs --budget 200    # a smaller bite
//   node scripts/backfill-scores.mjs --pages 0       # skip discovery, only fill gaps
//
// Reads DATABASE_URL / TMDB_API_KEY / OMDB_API_KEY from .env.local.

import "./load-env.mjs";
import postgres from "postgres";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number.parseInt(process.argv[i + 1] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};

// The paid tier allows 500,000 lookups a day and the whole catalogue is a few
// thousand, so the budget is no longer the thing that limits this: one run now
// finishes the job. Left well under the ceiling anyway, because the app spends
// from the same pot every time somebody opens a film page.
const BUDGET = arg("budget", 100_000);
const PAGES = arg("pages", 25);

const { DATABASE_URL, TMDB_API_KEY, OMDB_API_KEY } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set.");
if (!TMDB_API_KEY) throw new Error("TMDB_API_KEY is not set.");
if (!OMDB_API_KEY) throw new Error("OMDB_API_KEY is not set.");

const sql = postgres(DATABASE_URL);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(title, year) {
  const base = title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return year ? `${base}-${year}` : base;
}

/** Most-voted films first: the ones a leaderboard is actually about. */
async function discover(page) {
  const url = new URL("https://api.themoviedb.org/3/discover/movie");
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("sort_by", "vote_count.desc");
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("page", String(page));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB discover failed (${res.status})`);
  return (await res.json()).results ?? [];
}

async function details(tmdbId) {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

/** null when the id is unknown; throws only when the budget is actually spent. */
async function omdb(imdbId) {
  const res = await fetch(
    `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${OMDB_API_KEY}`,
  );
  const data = await res.json().catch(() => ({}));
  // The free tier reports exhaustion in the body with a 401, not a 429.
  if (data.Error && /limit reached/i.test(data.Error)) {
    const err = new Error("OMDb daily limit reached");
    err.exhausted = true;
    throw err;
  }
  if (data.Response === "False") return null;

  const pct = (v) => {
    const n = Number.parseInt(String(v ?? "").replace("%", ""), 10);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
  };
  const rt = (data.Ratings ?? []).find((r) => r.Source === "Rotten Tomatoes")?.Value;
  const imdb = data.imdbRating && data.imdbRating !== "N/A" ? Number.parseFloat(data.imdbRating) : null;
  const votes =
    data.imdbVotes && data.imdbVotes !== "N/A"
      ? Number.parseInt(String(data.imdbVotes).replace(/,/g, ""), 10)
      : null;

  return {
    rtScore: pct(rt),
    metacritic: pct(data.Metascore === "N/A" ? null : data.Metascore),
    // tenths, so nothing here becomes a float on the way to the screen
    imdbRating: imdb !== null && imdb >= 0 && imdb <= 10 ? Math.round(imdb * 10) : null,
    imdbVotes: Number.isFinite(votes) ? votes : null,
  };
}

// ── 1. discovery ───────────────────────────────────────────────────────────
let inserted = 0;
for (let page = 1; page <= PAGES; page++) {
  let results;
  try {
    results = await discover(page);
  } catch (e) {
    console.warn(`  discover page ${page} failed: ${e.message}`);
    break;
  }
  if (results.length === 0) break;

  for (const m of results) {
    if (!m.title) continue;
    const year = m.release_date ? Number.parseInt(m.release_date.slice(0, 4), 10) : null;
    const rows = await sql`
      insert into films (tmdb_id, slug, title, year, release_date, original_language, poster_path, backdrop_path, overview, popularity, vote_count)
      values (
        ${m.id},
        ${`${slugify(m.title, year)}-${m.id}`},
        ${m.title},
        ${Number.isFinite(year) ? year : null},
        ${m.release_date || null},
        ${m.original_language ?? null},
        ${m.poster_path ?? null},
        ${m.backdrop_path ?? null},
        ${m.overview ?? null},
        ${m.popularity ?? null},
        ${m.vote_count ?? null}
      )
      on conflict (tmdb_id) do nothing
      returning id`;
    if (rows.length) inserted++;
  }
  process.stdout.write(`\r  discovered page ${page}/${PAGES}, ${inserted} new films`);
}
console.log(`\n  ${inserted} films added to the catalogue`);

// ── 2. imdb ids from TMDB (no meaningful daily cap) ────────────────────────
const needIds = await sql`
  select id, tmdb_id from films
  where imdb_id is null and tmdb_id is not null
  order by vote_count desc nulls last
  limit ${BUDGET}`;

let ids = 0;
for (const f of needIds) {
  const d = await details(f.tmdb_id);
  if (d?.imdb_id) {
    await sql`update films set
      imdb_id = ${d.imdb_id},
      release_date = coalesce(${d.release_date || null}, release_date),
      runtime = coalesce(${d.runtime ?? null}, runtime),
      original_language = coalesce(${d.original_language ?? null}, original_language)
      where id = ${f.id}`;
    ids++;
  } else {
    // Stamp so the next run does not ask TMDB the same question forever.
    await sql`update films set imdb_id = '' where id = ${f.id}`;
  }
  if (ids % 25 === 0) process.stdout.write(`\r  imdb ids: ${ids}/${needIds.length}`);
  await sleep(30);
}
console.log(`\n  ${ids} imdb ids resolved`);

// ── 3. scores, until the budget or the day runs out ────────────────────────
const needScores = await sql`
  select id, title, imdb_id from films
  where imdb_id is not null and imdb_id <> '' and scores_refreshed_at is null
  order by vote_count desc nulls last
  limit ${BUDGET}`;

let scored = 0;
let blank = 0;
for (const f of needScores) {
  let s;
  try {
    s = await omdb(f.imdb_id);
  } catch (e) {
    if (e.exhausted) {
      console.log(`\n  OMDb daily limit reached after ${scored + blank} lookups. Run again tomorrow.`);
      break;
    }
    continue;
  }

  if (s) {
    await sql`
      update films set
        rt_score = ${s.rtScore}, metacritic = ${s.metacritic},
        imdb_rating = ${s.imdbRating}, imdb_votes = ${s.imdbVotes},
        scores_refreshed_at = now()
      where id = ${f.id}`;
    if (s.rtScore !== null || s.imdbRating !== null) scored++;
    else blank++;
  } else {
    // A film OMDb does not know is worth remembering, or every future run
    // spends a request rediscovering the same nothing.
    await sql`update films set scores_refreshed_at = now() where id = ${f.id}`;
    blank++;
  }
  if ((scored + blank) % 20 === 0) {
    process.stdout.write(`\r  scores: ${scored} found, ${blank} blank`);
  }
  await sleep(40);
}

const [totals] = await sql`
  select count(*)::int total,
         count(rt_score)::int rt,
         count(imdb_rating)::int imdb
  from films`;

console.log(`\n\n  catalogue: ${totals.total} films`);
console.log(`  with a Tomatometer: ${totals.rt}`);
console.log(`  with an IMDb score: ${totals.imdb}`);
console.log(`\n  Run again to continue where this left off.`);

await sql.end();
