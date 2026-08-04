// Puts series into the local catalogue and into the seeded crowd's diaries.
//
// The card, the binder, the archetype and the signature quartet all read the
// diary, so none of the show work can actually be judged until the seeded
// accounts watch television. Fifty accounts rating only films will always
// produce four films on every card, and the balance rule that decides how many
// of the four are series has nothing to act on.
//
// Existing accounts are added to rather than rebuilt. Their film ratings are
// the calibration everything else here was tuned against, and throwing that
// away to bolt on shows would move every archetype on the service at once.
//
// Each persona's taste is recovered from what they already rated: the
// rating-weighted centroid of their films' embeddings. Seasons are then rated
// by the same rule the crowd seeder uses, which is how the mix stays coherent
// rather than looking like two unrelated libraries stapled together.
//
// Usage:
//   npx tsx scripts/seed-shows.ts
//   npx tsx scripts/seed-shows.ts --shows-only    # catalogue, no diary rows
//
// LOCAL ONLY. It writes diary rows and refuses anything but localhost.

import "./load-env.mjs";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../src/db";
import { diaryEntries, films, shows, users } from "../src/db/schema";
import { ensureShow } from "../src/lib/shows";
import { searchShows, showDetails } from "../src/lib/tmdb";
import { seasonTitle } from "../src/lib/shows";

const host = /@([^/:]+)/.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "";
if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(host)) {
  throw new Error(`Refusing to seed shows into "${host}". This script only runs against localhost.`);
}

const SHOWS_ONLY = process.argv.includes("--shows-only");
const REPAIR = process.argv.includes("--repair");
/** Marks the accounts the crowd seeder owns. */
const TAG = "seed-crowd";

/**
 * A spread wide enough that the personas do not all land on the same shelf.
 *
 * Chosen by hand rather than pulled from a popularity endpoint: the point is
 * coverage, so this is prestige drama next to sitcoms next to anime next to
 * animation next to reality, across four decades. A page of TMDB's most
 * popular would be forty things from the last two years.
 */
const TITLES = [
  "Severance", "Succession", "Breaking Bad", "The Sopranos", "The Wire",
  "Mad Men", "Fleabag", "The Bear", "Chernobyl", "True Detective",
  "Better Call Saul", "Game of Thrones", "The Leftovers", "Twin Peaks",
  "The Office", "Parks and Recreation", "Community", "Arrested Development",
  "Seinfeld", "Curb Your Enthusiasm", "Peep Show", "The Thick of It",
  "Attack on Titan", "Death Note", "Fullmetal Alchemist: Brotherhood",
  "Cowboy Bebop", "Neon Genesis Evangelion", "Steins;Gate", "Vinland Saga",
  "Mob Psycho 100", "Jujutsu Kaisen", "Demon Slayer", "One Punch Man",
  "Monster", "Frieren", "Chainsaw Man",
  "Avatar: The Last Airbender", "BoJack Horseman", "Rick and Morty",
  "Arcane", "The Simpsons", "Bluey",
  "Planet Earth", "Chef's Table", "The Rehearsal",
  "Dark", "Money Heist", "Squid Game", "Lupin", "Call My Agent!",
  "The Americans", "Halt and Catch Fire", "Deadwood", "Six Feet Under",
  "Battlestar Galactica", "The X-Files", "Buffy the Vampire Slayer",
  "Andor", "The Last of Us", "Shogun", "Slow Horses", "Ted Lasso",
];

const dot = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i];
  return s;
};

/** A fixed generator, so a second run produces the same crowd. */
let seed = 20260803;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

async function ingest() {
  let made = 0;
  for (const title of TITLES) {
    const hits = await searchShows(title).catch(() => []);
    const best = hits[0];
    if (!best) {
      console.log(`  no match: ${title}`);
      continue;
    }
    const show = await ensureShow(best.id);
    if (show) made++;
    process.stdout.write(`\r  ${made}/${TITLES.length} shows in the catalogue`);
  }
  const [count] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(films)
    .where(eq(films.kind, "season"));
  console.log(`\n  ${count.n} season rows total.\n`);
}

async function rateSeasons() {
  const seasons = await db
    .select({
      id: films.id,
      title: films.title,
      embedding: films.embedding,
      voteCount: films.voteCount,
    })
    .from(films)
    .where(and(eq(films.kind, "season"), isNotNull(films.embedding)));

  if (seasons.length === 0) {
    console.log("  No embedded seasons. Run scripts/backfill-embeddings.mjs first.\n");
    return;
  }

  const crowd = await db.select().from(users).where(eq(users.bio, TAG));
  console.log(`  ${crowd.length} seeded accounts, ${seasons.length} embedded seasons.\n`);

  let written = 0;
  for (const person of crowd) {
    // Their taste, recovered rather than invented: the centred, rating-weighted
    // centroid of the films they already rated. Centring is what makes it taste
    // rather than "films they have seen".
    const rated = await db.execute(sql`
      select f.embedding, d.rating
      from (
        select distinct on (film_id) film_id, rating from diary_entries
        where user_id = ${person.id} and rating is not null
        order by film_id, watched_on desc nulls last, created_at desc
      ) d
      join films f on f.id = d.film_id
      where f.embedding is not null and f.kind = 'movie'
    `);
    const rows = rated as unknown as { embedding: number[]; rating: number }[];
    if (rows.length < 8) continue;

    const mean = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
    const sd =
      Math.sqrt(rows.reduce((s, r) => s + (r.rating - mean) ** 2, 0) / rows.length) || 10;

    const dim = rows[0].embedding.length;
    const taste = new Array(dim).fill(0);
    for (const r of rows) {
      const w = (r.rating - mean) / 10;
      for (let i = 0; i < dim; i++) taste[i] += w * r.embedding[i];
    }
    const mag = Math.sqrt(taste.reduce((s, x) => s + x * x, 0)) || 1;
    for (let i = 0; i < dim; i++) taste[i] /= mag;

    const affinity = seasons.map((s) => dot(taste, s.embedding ?? []));
    const aMu = affinity.reduce((s, x) => s + x, 0) / affinity.length;
    const aSd =
      Math.sqrt(affinity.reduce((s, x) => s + (x - aMu) ** 2, 0) / affinity.length) || 1;

    // Television is a bigger commitment than a film, so a persona watches
    // fewer of them: between a tenth and a third of their film count.
    const want = Math.min(
      seasons.length,
      Math.max(3, Math.round(rows.length * (0.1 + rnd() * 0.22))),
    );

    const picked = seasons
      .map((s, i) => ({ s, z: (affinity[i] - aMu) / aSd }))
      // Watched mostly for taste, partly at random, the way a shelf actually
      // fills: a strict ranking would give every persona the same shows.
      .sort((a, b) => b.z + rnd() * 1.6 - (a.z + rnd() * 1.6))
      .slice(0, want);

    const existing = new Set(
      (
        await db
          .select({ filmId: diaryEntries.filmId })
          .from(diaryEntries)
          .where(
            and(
              eq(diaryEntries.userId, person.id),
              inArray(
                diaryEntries.filmId,
                picked.map((p) => p.s.id),
              ),
            ),
          )
      ).map((r) => r.filmId),
    );

    const values = picked
      .filter((p) => !existing.has(p.s.id))
      .map((p) => {
        const noise = (rnd() + rnd() + rnd() - 1.5) * sd;
        const rating = Math.max(10, Math.min(100, Math.round((mean + p.z * 6 + noise) / 5) * 5));
        const daysAgo = 1 + Math.floor(rnd() * 900);
        return {
          userId: person.id,
          filmId: p.s.id,
          rating,
          watchedOn: new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10),
        };
      });

    if (values.length) {
      await db.insert(diaryEntries).values(values);
      written += values.length;
    }
    process.stdout.write(`\r  ${written} season ratings written`);
  }
  console.log("\n");
}

/**
 * Puts back the seasons that `hydrateFilm` overwrote.
 *
 * A season's TMDB id is also some unrelated film's id, so asking the movie
 * endpoint for it returned that film and the answer was saved: Breaking Bad
 * season one became "A Hero's Death". The fingerprint is a runtime, an IMDb id
 * or a refresh stamp, none of which a season ever gets legitimately.
 */
async function repair() {
  const damaged = await db
    .select()
    .from(films)
    .where(
      and(
        eq(films.kind, "season"),
        sql`(${films.runtime} is not null or ${films.imdbId} is not null or ${films.refreshedAt} is not null)`,
      ),
    );
  if (damaged.length === 0) {
    console.log("  Nothing to repair.\n");
    return;
  }
  console.log(`  ${damaged.length} seasons to restore.`);

  const byShow = new Map<string, typeof damaged>();
  for (const d of damaged) {
    if (!d.showId) continue;
    const list = byShow.get(d.showId) ?? [];
    list.push(d);
    byShow.set(d.showId, list);
  }

  for (const [showId, list] of byShow) {
    const [show] = await db.select().from(shows).where(eq(shows.id, showId)).limit(1);
    if (!show?.tmdbId) continue;
    const details = await showDetails(show.tmdbId).catch(() => null);
    if (!details) continue;
    for (const row of list) {
      const s = (details.seasons ?? []).find((x) => x.season_number === row.seasonNumber);
      await db
        .update(films)
        .set({
          title: seasonTitle(show.name, row.seasonNumber ?? 0, s?.name),
          year: Number.parseInt((s?.air_date ?? "").slice(0, 4), 10) || show.firstAirYear,
          releaseDate: s?.air_date || null,
          posterPath: s?.poster_path ?? show.posterPath,
          backdropPath: show.backdropPath,
          overview: s?.overview || show.overview,
          genres: show.genres,
          keywords: show.keywords,
          castNames: show.castNames,
          director: show.creators?.[0] ?? null,
          originalLanguage: show.originalLanguage,
          episodeCount: s?.episode_count ?? row.episodeCount,
          // The fingerprint, cleared so the row reads as a season again.
          runtime: null,
          imdbId: null,
          refreshedAt: null,
          rtScore: null,
          metacritic: null,
          imdbRating: null,
          imdbVotes: null,
        })
        .where(eq(films.id, row.id));
      console.log(`   restored ${row.slug}`);
    }
  }
  console.log();
}

async function main() {
  if (REPAIR) {
    console.log("\n  Repairing seasons overwritten by the movie endpoint...\n");
    await repair();
    process.exit(0);
  }

  console.log("\n  Bringing series into the catalogue...\n");
  await ingest();
  if (!SHOWS_ONLY) await rateSeasons();

  const [mix] = await db.execute(sql`
    select
      count(*) filter (where f.kind = 'movie')::int as films,
      count(*) filter (where f.kind = 'season')::int as seasons
    from diary_entries d join films f on f.id = d.film_id
    where d.rating is not null
  `) as unknown as { films: number; seasons: number }[];
  const total = mix.films + mix.seasons;
  console.log(
    `  diary now: ${mix.films} film ratings, ${mix.seasons} season ratings ` +
      `(${Math.round((mix.seasons / Math.max(1, total)) * 100)}% television)\n`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
