// Widens the local film catalogue from TMDB's own lists.
//
// The catalogue is normally filled on demand: a film row appears the first
// time somebody opens or searches for it. That is right for a real service and
// useless for judging anything that depends on catalogue size — the rank
// ladder, for one, where the top tier needs a library deeper than the local
// table could supply.
//
// Uses `bulkEnsureFilms`, the same upsert the browse pages use, so these rows
// are indistinguishable from ones a visitor would have created. Conflicts are
// ignored, so re-running only adds what is missing.
//
// Usage:
//   npx tsx scripts/seed-catalogue.ts                # ~1200 films
//   npx tsx scripts/seed-catalogue.ts --target 3000
//
// Reads DATABASE_URL / TMDB_API_KEY from .env.local.

import "./load-env.mjs";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { films } from "../src/db/schema";
import { bulkEnsureFilms } from "../src/lib/films";
import { popularMovies, topRatedMovies, topMoviesOfYear } from "../src/lib/tmdb";

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number.parseInt(process.argv[i + 1] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};

const count = async () =>
  Number(
    (
      await db
        .select({ n: sql<number>`count(*)::int` })
        .from(films)
        .where(eq(films.kind, "movie"))
    )[0].n,
  );

async function main() {
  const target = arg("target", 1200);
  const before = await count();
  console.log(`${before} films locally; aiming for ${target}`);

  /**
   * Three sources, not one.
   *
   * TMDB's popular and top-rated lists overlap heavily after the first dozen
   * pages, so leaning on either alone stops adding anything long before the
   * target. Walking a year at a time keeps pulling genuinely new rows and has
   * the side effect of spreading the catalogue across decades rather than
   * piling it onto whatever is popular this month.
   */
  const years: number[] = [];
  for (let y = new Date().getFullYear(); y >= 1950; y--) years.push(y);

  const sources: (() => Promise<{ id: number; title: string }[]>)[] = [];
  for (let page = 1; page <= 25; page++) sources.push(() => popularMovies(page));
  for (let page = 1; page <= 25; page++) sources.push(() => topRatedMovies(page));
  for (const year of years) {
    for (let page = 1; page <= 3; page++) sources.push(() => topMoviesOfYear(year, page));
  }

  let added = 0;
  let empty = 0;
  for (const source of sources) {
    if ((await count()) >= target) break;
    let batch;
    try {
      batch = await source();
    } catch (e) {
      // One bad page should not end the run; TMDB rate limits occasionally.
      console.warn(`  page failed: ${(e as Error).message}`);
      continue;
    }
    if (batch.length === 0) {
      if (++empty > 12) break;
      continue;
    }
    const before = await count();
    await bulkEnsureFilms(batch as never);
    const gained = (await count()) - before;
    added += gained;
    if (gained > 0) process.stdout.write(`+${gained} `);
  }

  const after = await count();
  console.log(`\n\n${after} films (+${after - before}); ${added} added this run`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
