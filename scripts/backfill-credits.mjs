// Fills the catalogue with directors and cast lists so the library can be
// searched by the people in a film, not just its title.
//
// Credits only ever arrived through hydrateFilm(), which runs when somebody
// opens a film page. That left the great majority of the catalogue with no
// cast at all, and a filter can only match what is stored. This walks the
// whole table once and fills the gaps.
//
// Unlike the score backfill there is no daily ceiling to respect here: credits
// come from TMDB, on our own key, appended to a call the app already makes.
//
// Usage:
//   node scripts/backfill-credits.mjs              # every film missing credits
//   node scripts/backfill-credits.mjs --limit 100  # a smaller bite
//   node scripts/backfill-credits.mjs --all        # refresh films that have them
//
// Reads DATABASE_URL / TMDB_API_KEY from .env.local.

import "./load-env.mjs";
import postgres from "postgres";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number.parseInt(process.argv[i + 1] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};

const LIMIT = arg("limit", 5000);
const ALL = process.argv.includes("--all");

const { DATABASE_URL, TMDB_API_KEY } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set.");
if (!TMDB_API_KEY) throw new Error("TMDB_API_KEY is not set.");

const sql = postgres(DATABASE_URL);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function credits(tmdbId) {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
  const res = await fetch(url);
  if (res.status === 429) {
    const err = new Error("TMDB rate limit");
    err.throttled = true;
    throw err;
  }
  if (!res.ok) return null;
  const d = await res.json();
  return {
    director: d.credits?.crew?.find((c) => c.job === "Director")?.name ?? null,
    // Billing order, which is the order TMDB returns. Ten is what the app
    // already stores, so a film hydrated on a page visit and one filled in
    // here hold the same thing.
    // sql.json, not JSON.stringify: a pre-stringified array reaches jsonb as a
    // JSON *string* rather than an array, and jsonb_array_length then refuses
    // every row it wrote.
    cast: (d.credits?.cast ?? []).slice(0, 10).map((c) => c.name).filter(Boolean),
  };
}

const missing = ALL
  ? await sql`
      select id, tmdb_id, title from films
      where tmdb_id is not null
      order by popularity desc nulls last
      limit ${LIMIT}`
  : await sql`
      select id, tmdb_id, title from films
      where tmdb_id is not null
        and (jsonb_typeof(cast_names) is distinct from 'array'
             or jsonb_array_length(cast_names) = 0
             or director is null)
      order by popularity desc nulls last
      limit ${LIMIT}`;

console.log(`\n  ${missing.length} films to fill.\n`);

let filled = 0;
let blank = 0;

for (const f of missing) {
  let c;
  try {
    c = await credits(f.tmdb_id);
  } catch (e) {
    if (e.throttled) {
      console.log(`\n  TMDB throttled after ${filled + blank}. Waiting 10s.`);
      await sleep(10_000);
      continue;
    }
    blank++;
    continue;
  }

  if (c && (c.cast.length || c.director)) {
    await sql`
      update films set
        director = coalesce(${c.director}, director),
        cast_names = coalesce(${c.cast.length ? sql.json(c.cast) : null}, cast_names)
      where id = ${f.id}`;
    filled++;
  } else {
    blank++;
  }

  if ((filled + blank) % 20 === 0) {
    process.stdout.write(`\r  ${filled} filled, ${blank} without credits`);
  }
  await sleep(30);
}

const [totals] = await sql`
  select count(*)::int total,
         count(director)::int with_director,
         count(*) filter (where jsonb_typeof(cast_names) = 'array'
                          and jsonb_array_length(cast_names) > 0)::int with_cast
  from films`;

console.log(`\n\n  catalogue: ${totals.total} films`);
console.log(`  with a director: ${totals.with_director}`);
console.log(`  with a cast list: ${totals.with_cast}`);

await sql.end();
