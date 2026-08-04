// Rebuilds the MyAnimeList -> TMDB mapping the anime importer reads.
//
// MyAnimeList numbers its own catalogue and we hold TMDB, so an exported list
// is 400 rows of ids that mean nothing here. Nobody publishes a direct map, but
// Fribb/anime-lists merges the community mapping projects and does carry
// mal_id, themoviedb_id and, critically, the TMDB season number.
//
// The season number is the whole reason this works. MyAnimeList files each
// season of a series as its own entry with its own score, which is exactly how
// Tenpoint stores television: their model and ours already agree, so a MAL list
// lands as season rows rather than needing to be flattened into one opinion per
// series.
//
// The result is committed rather than fetched at runtime. It is 141 KB, it
// changes slowly, and an importer that depends on a third-party file being
// reachable is an importer that breaks on a day nobody is watching.
//
// Usage:
//   npx tsx scripts/build-mal-map.ts

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SOURCE = "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";
const OUT = resolve(process.cwd(), "src/lib/mal-map.json");

type Entry = {
  mal_id?: number;
  themoviedb_id?: { tv?: number | null; movie?: number | number[] | null } | number | null;
  season?: { tmdb?: number | null } | null;
};

async function main() {
  console.log("\n  Fetching the anime mapping...\n");
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Source returned ${res.status}`);
  const all = (await res.json()) as Entry[];
  console.log(`  ${all.length} entries upstream.`);

  /**
   * `[tmdbId, season]`, with season 0 meaning a film.
   *
   * A pair of numbers rather than an object: at eight thousand entries the key
   * names would be most of the file, and this one is read on every anime
   * import.
   */
  const map: Record<string, [number, number]> = {};
  let films = 0;
  let seasons = 0;

  for (const e of all) {
    const mal = e.mal_id;
    const t = e.themoviedb_id;
    if (!mal || !t || typeof t === "number") continue;

    if (t.movie) {
      // Some films list several TMDB ids; the first is the feature itself.
      const id = Array.isArray(t.movie) ? t.movie[0] : t.movie;
      if (id) {
        map[String(mal)] = [id, 0];
        films++;
      }
      continue;
    }

    if (t.tv) {
      // A missing season number means the entry is the series' only season.
      const s = e.season?.tmdb;
      map[String(mal)] = [t.tv, typeof s === "number" ? s : 1];
      seasons++;
    }
  }

  const json = JSON.stringify(map);
  await writeFile(OUT, json);
  console.log(
    `  ${Object.keys(map).length} MAL ids mapped: ${films} films, ${seasons} series seasons.`,
  );
  console.log(`  ${Math.round(json.length / 1024)} KB written to src/lib/mal-map.json\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
