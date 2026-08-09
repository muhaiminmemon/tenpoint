/**
 * The semantic evaluation harness.
 *
 * Evaluation code, kept out of the app: nothing here is imported by production.
 * Its job is to make a model revision cheap to judge — declare a fixture as an
 * intent in English, build it from real catalogue titles, and print what each
 * model says about the person so a human can decide whether it understood them.
 *
 *   npx tsx scripts/eval/semantic-eval.mts            # all fixtures
 *   npx tsx scripts/eval/semantic-eval.mts golden     # title golden set
 *   npx tsx scripts/eval/semantic-eval.mts 13 14 17   # named fixtures
 */
import "../load-env.mjs";
import { db } from "../../src/db";
import { sql } from "drizzle-orm";
import { semanticProfile, topDimensions, DIMENSIONS, DIMENSION_LABELS } from "../../src/lib/semantic";
import {
  buildSemanticPreferenceProfile,
  ranked,
  strongestAffinities,
  type SemanticProfileInput,
} from "../../src/lib/semantic-profile";
import { buildPreferenceProfile, type ProfileInput } from "../../src/lib/preference-profile";

type Title = {
  title: string;
  kind: string;
  genres: string[] | null;
  keywords: string[] | null;
  overview: string | null;
  reach: number | null;
  year: number | null;
  language: string | null;
};

const rows = (await db.execute(sql`
  select f.title, f.kind, f.genres, f.keywords, f.overview, f.year, f.original_language as language,
         coalesce(f.imdb_votes, f.vote_count * 50) as reach
  from films f where f.kind in ('movie','show') order by f.title`)) as unknown as Title[];

const sem = new Map(rows.map((r) => [r.title, semanticProfile(r)]));
const dimOf = (t: Title, d: string) => sem.get(t.title)!.dimensions[d as never] as number;

/** Titles the catalogue actually has, sorted by how strongly they are one thing. */
const strongest = (dim: string, n: number, filter: (t: Title) => boolean = () => true) =>
  rows.filter(filter).sort((a, b) => dimOf(b, dim) - dimOf(a, dim)).slice(0, n);

const MAINSTREAM = (t: Title) => (t.reach ?? 0) >= 150_000;
const OBSCURE = (t: Title) => (t.reach ?? 0) > 0 && (t.reach ?? 0) < 40_000;

type Fixture = {
  id: string;
  name: string;
  intent: string;
  /** [title, rating in tenths] */
  library: () => [Title, number][];
};

/** Rate a set: `loved` get high marks, `filler` get middling ones. */
const mix = (loved: Title[], lovedAt: number, filler: Title[], fillerAt: number) =>
  [
    ...loved.map((t) => [t, lovedAt] as [Title, number]),
    ...filler.map((t) => [t, fillerAt] as [Title, number]),
  ];

const FIXTURES: Fixture[] = [
  {
    id: "13",
    name: "Mainstream exposure, obscure favourites",
    intent:
      "Watches what everyone watches, but the titles they actually rate highly are the little-seen ones. Exposure should look mainstream; preference should not.",
    library: () => mix(strongest("psychological", 8, OBSCURE), 95, strongest("action", 22, MAINSTREAM), 62),
  },
  {
    id: "14",
    name: "Obscure exposure, mainstream favourites",
    intent:
      "Digs through the unseen out of habit, but the works that actually land are the popular ones. The inverse of 13.",
    library: () => mix(strongest("wonder", 8, MAINSTREAM), 95, strongest("human", 22, OBSCURE), 62),
  },
  {
    id: "17",
    name: "Comedy exposure, drama favourites",
    intent:
      "Puts on comedy constantly and rates it fine. Reserves real admiration for serious character drama. Preference must separate from exposure.",
    library: () => mix(strongest("human", 8), 96, strongest("comedy", 24), 65),
  },
  {
    id: "2",
    name: "Anime-heavy",
    intent:
      "Almost everything is anime. Should read as worldbuilding/action taste, not as a separate 'anime' identity.",
    library: () => {
      const anime = rows.filter((t) => (t.keywords ?? []).some((k) => k.toLowerCase() === "anime"));
      return mix(anime.slice(0, 10), 92, anime.slice(10, 20), 78);
    },
  },
  {
    id: "6",
    name: "Horror obsessive",
    intent: "Horror above all. Horror and Atmospheric should dominate both halves.",
    library: () => mix(strongest("horror", 10), 93, strongest("horror", 20).slice(10), 76),
  },
  {
    id: "18",
    name: "Worldbuilding across formats",
    intent:
      "Loves invented worlds in anime, sci-fi film and fantasy series alike. Identity must not split by medium.",
    library: () => {
      const w = strongest("worldbuilding", 20);
      return mix(w.slice(0, 10), 94, w.slice(10), 80);
    },
  },
];

const pct = (n: number) => (n * 100).toFixed(0).padStart(3) + "%";

function report(f: Fixture) {
  const lib = f.library().filter(([t]) => t);
  if (lib.length < 8) {
    console.log(`\n### ${f.id} ${f.name}: SKIPPED — catalogue supplied only ${lib.length} titles`);
    return;
  }
  const mean = lib.reduce((n, [, r]) => n + r, 0) / lib.length;
  const sd =
    Math.sqrt(lib.reduce((n, [, r]) => n + (r - mean) ** 2, 0) / lib.length) || 10;
  const affection = (r: number) => Math.max(0, Math.min(1, (r - mean) / (2 * sd) + 0.5));

  console.log("\n" + "=".repeat(66));
  console.log(`FIXTURE ${f.id} — ${f.name}`);
  console.log("=".repeat(66));
  console.log(`INTENT: ${f.intent}`);
  console.log(
    `LIBRARY: ${lib.length} titles (${lib.filter(([t]) => t.kind === "show").length} shows), mean ${(mean / 10).toFixed(1)}`,
  );

  // ---- OLD model -------------------------------------------------------
  const oldInputs: ProfileInput[] = lib.map(([t, r]) => ({
    keywords: t.keywords,
    year: t.year,
    language: t.language,
    reach: t.reach,
    affection: affection(r),
  }));
  const oldProfile = buildPreferenceProfile(oldInputs);
  console.log("\n-- OLD (binary clusters) --");
  console.log(
    "  preference: " +
      (oldProfile.top.slice(0, 5).map((t) => `${t.name} ${pct(t.share)}`).join("  ") || "none"),
  );

  // ---- NEW model -------------------------------------------------------
  const newInputs: SemanticProfileInput[] = lib.map(([t, r]) => ({
    genres: t.genres,
    keywords: t.keywords,
    overview: t.overview,
    affection: affection(r),
  }));
  const v2 = buildSemanticPreferenceProfile(newInputs);

  console.log("\n-- SEMANTIC V2 --");
  console.log("  exposure:   " + ranked(v2.exposure, 5).map((d) => `${d.label} ${pct(d.value)}`).join("  "));
  console.log("  preference: " + ranked(v2.preference, 5).map((d) => `${d.label} ${pct(d.value)}`).join("  "));
  console.log(
    "  loved more than watched: " +
      strongestAffinities(v2, 3).map((d) => `${d.label} ${d.affinity.toFixed(2)}×`).join("  "),
  );
  console.log(`  semantic confidence: ${v2.confidence.toFixed(2)}`);
}

const args = process.argv.slice(2);

if (args[0] === "golden") {
  const GOLDEN: [string, string][] = [
    ["Breaking Bad", "Crime should lead; Human Drama plausible; Comedy/Wonder should not"],
    ["Seinfeld", "Comedy clearly leads; Comfort plausible; Crime/Horror/Action should not"],
    ["The Office", "Comedy leads; Comfort plausible"],
    ["Severance", "Psychological and Mystery lead; Comedy should not"],
    ["The X-Files", "Mystery leads; Crime and Worldbuilding plausible"],
    ["Attack on Titan", "Action and Worldbuilding lead; must not be generic 'anime'"],
    ["Naruto", "Action/Adventure lead — battle shounen is legitimate here"],
    ["The Simpsons", "Comedy leads; Social plausible; Action/Horror should not"],
    ["Rick and Morty", "Comedy and Worldbuilding both; neither alone"],
    ["Game of Thrones", "Worldbuilding leads; Historical plausible"],
    ["Dune: Part Two", "Worldbuilding and Adventure lead"],
    ["The Wild Robot", "Wonder/Comfort lead; Crime should not"],
    ["The Leftovers", "Human Drama/Emotional/Psychological; not Action"],
  ];
  console.log("=== TITLE GOLDEN SET ===");
  for (const [name, expectation] of GOLDEN) {
    const t = rows.find((r) => r.title === name);
    if (!t) { console.log(`\n${name}: NOT IN CATALOGUE`); continue; }
    const p = sem.get(name)!;
    console.log(`\n${name}`);
    console.log(`  expect: ${expectation}`);
    console.log(
      `  actual: ${topDimensions(p, 4).map((d) => `${d.label} ${d.value.toFixed(2)}`).join("  ")}  [conf ${p.confidence.toFixed(2)}]`,
    );
  }
} else {
  const wanted = args.length ? FIXTURES.filter((f) => args.includes(f.id)) : FIXTURES;
  for (const f of wanted) report(f);
}

process.exit(0);
