// Puts back whole-series rows that the movie endpoint overwrote.
//
// A series is represented in `films` by one row carrying the series' own TMDB
// id, and TMDB numbers films and television separately: id 45950 is High School
// DxD as a programme and La passione as a film. `hydrateFilm` asked /movie/{id}
// for those rows and saved the answer, so opening a series through /film/ wrote
// an unrelated film's title, poster, year and runtime over it. Buffy the Vampire
// Slayer became Armageddon.
//
// The guard in hydrateFilm now admits only `kind = 'movie'`, so no new damage is
// possible. This repairs what was already written.
//
// Nothing is fetched. Every field a whole-series row needs already lives on the
// `shows` row beside it, which was never touched, so the repair is a copy and
// cannot itself go wrong.
//
// Usage:
//   npx tsx scripts/repair-show-rows.ts          # report only
//   npx tsx scripts/repair-show-rows.ts --write  # apply
//
// Safe against production: it only ever writes rows whose kind is 'show', and
// only from the shows table.

import "./load-env.mjs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { films, shows } from "../src/db/schema";

const WRITE = process.argv.includes("--write");

async function main() {
  const damaged = await db
    .select({
      id: films.id,
      title: films.title,
      showId: shows.id,
      name: shows.name,
      firstAirYear: shows.firstAirYear,
      posterPath: shows.posterPath,
      backdropPath: shows.backdropPath,
      overview: shows.overview,
      genres: shows.genres,
      keywords: shows.keywords,
      castNames: shows.castNames,
      creators: shows.creators,
      originalLanguage: shows.originalLanguage,
      popularity: shows.popularity,
      voteCount: shows.voteCount,
      voteAverage: shows.voteAverage,
      imdbId: shows.imdbId,
    })
    .from(films)
    .innerJoin(shows, eq(shows.id, films.showId))
    .where(
      and(
        eq(films.kind, "show"),
        // The fingerprint of a movie fetch: a runtime, a refresh stamp, or a
        // title that has drifted from the series it stands for.
        sql`(${films.runtime} is not null or ${films.refreshedAt} is not null or ${films.title} <> ${shows.name})`,
      ),
    );

  if (damaged.length === 0) {
    console.log("\n  No damaged series rows.\n");
    return;
  }

  console.log(`\n  ${damaged.length} series row${damaged.length === 1 ? "" : "s"} to restore:\n`);
  for (const d of damaged) console.log(`    "${d.title}" -> "${d.name}"`);

  if (!WRITE) {
    console.log("\n  Nothing written. Re-run with --write to apply.\n");
    return;
  }

  for (const d of damaged) {
    await db
      .update(films)
      .set({
        title: d.name,
        year: d.firstAirYear,
        posterPath: d.posterPath,
        backdropPath: d.backdropPath,
        overview: d.overview,
        genres: d.genres,
        keywords: d.keywords,
        castNames: d.castNames,
        director: d.creators?.[0] ?? null,
        originalLanguage: d.originalLanguage,
        popularity: d.popularity,
        voteCount: d.voteCount,
        audienceRating: d.voteAverage,
        imdbId: d.imdbId,
        // Cleared so the row reads as a series again rather than a film.
        runtime: null,
        refreshedAt: null,
        rtScore: null,
        metacritic: null,
        imdbRating: null,
        imdbVotes: null,
      })
      .where(eq(films.id, d.id));
  }

  console.log(`\n  Restored ${damaged.length}.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
