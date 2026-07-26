// Seeds three demo accounts with real TMDB films released 2020-2026, so the
// full flow (import-free) can be clicked through: library, diary, watchlist,
// friends, "what should we watch", lists, reviews/comments.
//
// Usage: node scripts/seed-demo.mjs
// Reads DATABASE_URL / TMDB_API_KEY from .env.local.

import "./load-env.mjs";
import { randomBytes, randomUUID, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const scrypt = promisify(scryptCb);

const DATABASE_URL = process.env.DATABASE_URL;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
if (!DATABASE_URL || !TMDB_API_KEY) {
  console.error("DATABASE_URL and TMDB_API_KEY must be set in .env.local");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

function slugify(title, year) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return year ? `${base}-${year}` : base || "film";
}

const GENRES_BY_ID = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Science Fiction", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
};

async function fetchTmdbPage(page) {
  const url = new URL("https://api.themoviedb.org/3/discover/movie");
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("primary_release_date.gte", "2020-01-01");
  url.searchParams.set("primary_release_date.lte", "2026-12-31");
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("vote_count.gte", "150");
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("page", String(page));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

async function movieDetails(tmdbId) {
  const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("append_to_response", "credits");
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

function directorOf(details) {
  const d = details.credits?.crew?.filter((c) => c.job === "Director") ?? [];
  return d.length ? d.map((x) => x.name).join(", ") : null;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  console.log("Fetching 2020-2026 films from TMDB...");
  const pages = await Promise.all([1, 2, 3, 4, 5].map(fetchTmdbPage));
  const seen = new Map();
  for (const page of pages) for (const m of page) if (!seen.has(m.id)) seen.set(m.id, m);
  const pool = [...seen.values()].slice(0, 90);
  console.log(`Got ${pool.length} candidate films. Hydrating directors (this takes a minute)...`);

  const filmIds = new Map(); // tmdbId -> films.id
  for (const m of pool) {
    const details = await movieDetails(m.id).catch(() => null);
    const year = Number((m.release_date ?? "").slice(0, 4)) || null;
    const slug = `${slugify(m.title, year)}-${m.id}`;
    const genres = (m.genre_ids ?? []).map((g) => GENRES_BY_ID[g]).filter(Boolean);
    const row = await sql`
      insert into films (id, tmdb_id, slug, title, year, poster_path, backdrop_path,
        director, runtime, genres, overview, popularity, vote_count, refreshed_at)
      values (${randomUUID()}, ${m.id}, ${slug}, ${m.title}, ${year},
        ${m.poster_path ?? null}, ${m.backdrop_path ?? null},
        ${details ? directorOf(details) : null}, ${details?.runtime ?? null},
        ${genres.length ? sql.json(genres) : null}, ${m.overview ?? null},
        ${m.popularity ?? null}, ${m.vote_count ?? null}, now())
      on conflict (tmdb_id) do update set
        director = excluded.director, runtime = excluded.runtime,
        genres = excluded.genres, refreshed_at = now()
      returning id, tmdb_id
    `;
    filmIds.set(m.id, row[0].id);
  }
  console.log(`Cached ${filmIds.size} films.`);

  const pool_ids = pool.map((m) => filmIds.get(m.id));

  // three demo accounts, overlapping-but-distinct taste
  const accounts = [
    { username: "nadia", displayName: "Nadia", email: "nadia@example.com", seed: 1, meanBias: 8 },
    { username: "theo", displayName: "Theo", email: "theo@example.com", seed: 2, meanBias: 0 },
    { username: "priya", displayName: "Priya", email: "priya@example.com", seed: 3, meanBias: -4 },
  ];

  const passwordHash = await hashPassword("demopass123");
  const userIds = {};
  for (const acc of accounts) {
    await sql`delete from users where username = ${acc.username}`;
    const id = randomUUID();
    userIds[acc.username] = id;
    await sql`
      insert into users (id, username, display_name, email, password_hash, privacy, email_verified_at)
      values (${id}, ${acc.username}, ${acc.displayName}, ${acc.email}, ${passwordHash}, 'public', now())
    `;
  }
  console.log("Created accounts: " + accounts.map((a) => a.username).join(", ") + " (password: demopass123)");

  // deterministic per-user shuffles so each has a distinct but overlapping slate
  for (const acc of accounts) {
    const rand = mulberry32(acc.seed * 7919);
    const shuffled = [...pool_ids].sort(() => rand() - 0.5);
    const myFilms = shuffled.slice(0, 34); // ~34 rated/watched films each

    let dayOffset = 0;
    for (let i = 0; i < myFilms.length; i++) {
      const filmId = myFilms[i];
      dayOffset += 3 + Math.floor(rand() * 9);
      const watchedOn = new Date(2020, 0, 1 + dayOffset);
      if (watchedOn > new Date(2026, 6, 1)) break;
      const dateStr = watchedOn.toISOString().slice(0, 10);

      // ~90% rated, biased per-user mean, occasional unrated "watched"
      const rated = rand() > 0.1;
      const rating = rated
        ? Math.min(100, Math.max(10, Math.round((55 + acc.meanBias + rand() * 40) / 1) ))
        : null;

      await sql`
        insert into diary_entries (id, user_id, film_id, watched_on, rating, rewatch)
        values (${randomUUID()}, ${userIds[acc.username]}, ${filmId}, ${dateStr}, ${rating}, false)
        on conflict do nothing
      `;

      // sprinkle a couple of rewatches to exercise the "current rating" rule
      if (i === 2 || i === 9) {
        const laterDate = new Date(watchedOn);
        laterDate.setMonth(laterDate.getMonth() + 8);
        if (laterDate <= new Date(2026, 6, 1)) {
          const rewatchRated = i === 9 ? null : Math.min(100, Math.max(10, (rating ?? 70) + 10));
          await sql`
            insert into diary_entries (id, user_id, film_id, watched_on, rating, rewatch)
            values (${randomUUID()}, ${userIds[acc.username]}, ${filmId},
              ${laterDate.toISOString().slice(0, 10)}, ${rewatchRated}, true)
            on conflict do nothing
          `;
        }
      }
    }

    // a couple of watchlist entries with capture reason
    const watchlistFilms = shuffled.slice(34, 37);
    const sources = ["Recommended by a friend", "Saw the trailer online", null];
    for (let i = 0; i < watchlistFilms.length; i++) {
      await sql`
        insert into watchlist (id, user_id, film_id, source)
        values (${randomUUID()}, ${userIds[acc.username]}, ${watchlistFilms[i]}, ${sources[i]})
        on conflict do nothing
      `;
    }
  }

  // one visible review, one spoiler review, for testing the reveal + comments
  const nadiaFirstFilm = pool_ids[0];
  const nadiaEntry = await sql`
    select id from diary_entries where user_id = ${userIds.nadia} and film_id = ${nadiaFirstFilm} limit 1
  `;
  if (nadiaEntry[0]) {
    await sql`
      update diary_entries set
        review = 'Rewatched this on a whim and it holds up completely. The pacing in the back half is the best thing about it.',
        spoiler = false
      where id = ${nadiaEntry[0].id}
    `;
  }
  const theoFilm = pool_ids[1];
  const theoEntry = await sql`
    select id from diary_entries where user_id = ${userIds.theo} and film_id = ${theoFilm} limit 1
  `;
  if (theoEntry[0]) {
    await sql`
      update diary_entries set
        review = 'The twist in the final act recontextualizes literally everything before it. Did not see it coming.',
        spoiler = true
      where id = ${theoEntry[0].id}
    `;
  }

  // friendships: nadia <-> theo already friends; priya -> nadia pending request
  await sql`
    insert into friendships (id, user_low_id, user_high_id)
    values (${randomUUID()},
      ${userIds.nadia < userIds.theo ? userIds.nadia : userIds.theo},
      ${userIds.nadia < userIds.theo ? userIds.theo : userIds.nadia})
    on conflict do nothing
  `;
  await sql`
    insert into friend_requests (id, from_id, to_id)
    values (${randomUUID()}, ${userIds.priya}, ${userIds.nadia})
    on conflict do nothing
  `;

  const counts = await sql`
    select u.username, count(*) filter (where d.rating is not null) rated,
      count(*) filter (where d.rating >= 80) strong, count(*) total
    from diary_entries d join users u on u.id = d.user_id
    where u.username in ('nadia','theo','priya')
    group by 1 order by 1
  `;
  console.log("\nSeeded:");
  for (const c of counts) {
    console.log(`  ${c.username}: ${c.total} entries, ${c.rated} rated, ${c.strong} rated >=8.0`);
  }
  console.log("\nnadia <-> theo: friends already");
  console.log("priya -> nadia: pending friend request (test accept/decline)");
  console.log("theo <-> priya: not connected (test search + request)");
  console.log("\nLog in as any of them with password: demopass123");

  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
