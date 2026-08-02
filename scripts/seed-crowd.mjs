// Fills a local database with a crowd: fifty accounts with libraries that
// differ the way real ones do, all friends with `demo`.
//
// Everything downstream of the taste card is a function of how much diary
// there is to read, and with four seeded accounts most of it has nothing to
// work on: affinity compares four people, the rival panel picks from two, and
// the archetype vocabulary has no way to show whether it actually spreads.
// This produces enough shelves to see the shape of the thing.
//
// The libraries are deliberately unalike. Each account draws from a leaning
// (a genre it over-indexes on, an era it prefers, whether it reads subtitles),
// rates on its own scale (a hard marker's 7 and a generous marker's 9 are the
// same opinion), and some of them rewatch and write while most do not, which
// is what real diaries look like.
//
// Usage:
//   node scripts/seed-crowd.mjs            # create or top up the crowd
//   node scripts/seed-crowd.mjs --clean    # remove every seeded account
//
// LOCAL ONLY. It refuses to run against anything but localhost, because it
// writes users and diary entries and there is no version of that which should
// ever touch production.

import "./load-env.mjs";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set.");

const host = /@([^/:]+)/.exec(DATABASE_URL)?.[1] ?? "";
if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(host)) {
  throw new Error(
    `Refusing to seed a crowd into "${host}". This script only runs against localhost.`,
  );
}

const CLEAN = process.argv.includes("--clean");
const COUNT = 50;
/** Marks every row this script owns, so cleaning up can be exact. */
const TAG = "seed-crowd";

const sql = postgres(DATABASE_URL);

// A fixed generator, so re-running produces the same crowd rather than a new
// one every time and the numbers stay comparable between runs.
let seed = 20260802;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const range = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const FIRST = [
  "Nour", "Ilya", "Mara", "Kwame", "Sanne", "Tobias", "Ines", "Hugo", "Yuki", "Rafael",
  "Amara", "Dmitri", "Lena", "Oskar", "Priyanka", "Mateo", "Freya", "Caleb", "Zaina", "Bo",
  "Anouk", "Emre", "Sofia", "Jonas", "Leila", "Marcus", "Ayaka", "Tomas", "Nadia", "Idris",
  "Elin", "Rohan", "Clara", "Yusuf", "Maja", "Andre", "Sara", "Kai", "Beatriz", "Milo",
  "Hana", "Viktor", "Noor", "Felix", "Camille", "Arjun", "Greta", "Omar", "Suki", "Lars",
];
const LAST = [
  "Halim", "Vasquez", "Okafor", "Lindqvist", "Moreau", "Bergman", "Castro", "Nakamura",
  "Duarte", "Sokolov", "Weber", "Fontaine", "Iyer", "Novak", "Aziz", "Ferreira", "Lund",
  "Marchetti", "Bakker", "Osei",
];

/** What a shelf leans on. Real libraries are lopsided; uniform ones are not real. */
const LEANINGS = [
  { key: "horror", genres: ["Horror", "Thriller", "Mystery"] },
  { key: "arthouse", genres: ["Drama", "Romance"] },
  { key: "blockbuster", genres: ["Action", "Adventure", "Science Fiction"] },
  { key: "animation", genres: ["Animation", "Family", "Fantasy"] },
  { key: "crime", genres: ["Crime", "Thriller", "Mystery"] },
  { key: "comedy", genres: ["Comedy", "Romance"] },
  { key: "docs", genres: ["Documentary", "History", "War"] },
  { key: "scifi", genres: ["Science Fiction", "Fantasy", "Adventure"] },
  { key: "omnivore", genres: [] },
];

async function clean() {
  const users = await sql`select id, username from users where bio = ${TAG}`;
  if (users.length === 0) {
    console.log("\n  Nothing to clean: no seeded accounts found.\n");
    return;
  }
  const ids = users.map((u) => u.id);
  // Diary rows, friendships and everything else hang off the user row with
  // `on delete cascade`, so one delete is the whole cleanup.
  const gone = await sql`delete from users where id in ${sql(ids)}`;
  console.log(`\n  Removed ${gone.count} seeded accounts and everything attached to them.\n`);
}

async function seedCrowd() {
  const [demo] = await sql`select id from users where username = 'demo'`;
  if (!demo) throw new Error("No `demo` account to attach the crowd to.");

  const films = await sql`
    select id, year, genres, original_language, vote_count
    from films
    where poster_path is not null and jsonb_typeof(genres) = 'array'
  `;
  if (films.length < 50) throw new Error("Too few films in the catalogue to build libraries from.");
  console.log(`\n  ${films.length} films to draw from.\n`);

  const existing = new Set(
    (await sql`select username from users`).map((u) => u.username),
  );

  let made = 0;
  for (let i = 0; i < COUNT; i++) {
    const first = FIRST[i % FIRST.length];
    const last = pick(LAST);
    let username = `${first}${last}`.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (existing.has(username)) username = `${username}${i}`;
    if (existing.has(username)) continue;
    existing.add(username);

    const lean = pick(LEANINGS);
    // A rating scale of their own: where the middle sits and how far they
    // stray from it. Hard markers and generous ones are both real.
    const centre = 55 + Math.floor(rnd() * 35);
    const spread = 6 + Math.floor(rnd() * 22);
    const oldLean = rnd();
    const subLean = rnd();
    const obscureLean = rnd();
    const size = range(8, 240);
    // Most people never rewatch and never write. A few do both.
    const rewatcher = rnd() < 0.25;
    const writer = rnd() < 0.2;

    const userId = randomUUID();
    await sql`
      insert into users (id, username, display_name, email, password_hash, bio, privacy, email_verified_at, created_at)
      values (
        ${userId}, ${username}, ${`${first} ${last}`},
        ${`${username}@seed.local`},
        ${"seeded-no-login"}, ${TAG}, 'public', now(),
        now() - (${range(30, 700)} || ' days')::interval
      )
    `;

    // Draw a shelf. The leaning is a bias, not a filter: everybody watches
    // something outside their lane, which is what makes the numbers interesting.
    const chosen = new Map();
    let guard = 0;
    while (chosen.size < size && guard++ < size * 60) {
      const f = films[Math.floor(rnd() * films.length)];
      if (chosen.has(f.id)) continue;
      const genres = f.genres ?? [];
      if (lean.genres.length && !genres.some((g) => lean.genres.includes(g)) && rnd() < 0.72) continue;
      if (f.year && f.year < 1990 && rnd() > oldLean * 0.85 + 0.1) continue;
      if (f.original_language && f.original_language !== "en" && rnd() > subLean * 0.85 + 0.1) continue;
      if ((f.vote_count ?? 0) >= 3000 && rnd() < obscureLean * 0.5) continue;
      chosen.set(f.id, f);
    }

    const rows = [];
    for (const f of chosen.values()) {
      // Triangular noise around their centre, so ratings cluster the way a
      // person's do rather than spreading flat across the scale.
      const noise = (rnd() + rnd() + rnd() - 1.5) * spread;
      const rating = Math.max(10, Math.min(100, Math.round((centre + noise) / 10) * 10 + (rnd() < 0.45 ? 0 : range(-4, 4))));
      const daysAgo = range(1, 900);
      rows.push({
        id: randomUUID(),
        user_id: userId,
        film_id: f.id,
        rating: Math.max(10, Math.min(100, rating)),
        watched_on: new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10),
        review: writer && rnd() < 0.18 ? "Stayed with me longer than I expected." : null,
        rewatch: false,
      });
      // A rewatcher goes back to a few of the ones they rate highest.
      if (rewatcher && rating >= centre + spread && rnd() < 0.35) {
        for (let r = 0; r < range(1, 3); r++) {
          rows.push({
            id: randomUUID(),
            user_id: userId,
            film_id: f.id,
            rating: Math.max(10, Math.min(100, rating + range(-3, 3))),
            watched_on: new Date(Date.now() - range(1, daysAgo) * 86_400_000).toISOString().slice(0, 10),
            review: null,
            rewatch: true,
          });
        }
      }
    }

    for (let k = 0; k < rows.length; k += 500) {
      await sql`insert into diary_entries ${sql(rows.slice(k, k + 500))}`;
    }

    const [lo, hi] = userId < demo.id ? [userId, demo.id] : [demo.id, userId];
    await sql`
      insert into friendships (user_low_id, user_high_id) values (${lo}, ${hi})
      on conflict do nothing
    `;

    made++;
    process.stdout.write(`\r  ${made}/${COUNT} accounts, latest ${username} (${rows.length} entries)   `);
  }

  const [tot] = await sql`
    select count(*)::int accounts,
           (select count(*)::int from diary_entries d
             join users u on u.id = d.user_id where u.bio = ${TAG}) as entries
    from users where bio = ${TAG}`;
  console.log(`\n\n  ${tot.accounts} seeded accounts, ${tot.entries} diary entries, all friends with demo.\n`);
}

if (CLEAN) await clean();
else await seedCrowd();

await sql.end();
