// Fifteen accounts whose libraries are led by television.
//
// The fifty seeded personas all came from films and then had series added on
// top, so every one of them tops out around a quarter television. That is a
// legitimate kind of viewer and it is the only kind the crowd contains, which
// means whole branches of the card have never been exercised: the three
// television clusters cannot win a title, the film/show split stat has no
// interesting values to show, and anything keyed off finishing or abandoning a
// series has nothing to read.
//
// These fifteen are the other end. Each is built from television first, with a
// smaller film shelf chosen to match what they already watch rather than
// picked at random, because a persona whose films contradict their series is
// noise rather than a viewer.
//
// The watching behaviours matter as much as the taste. Somebody who finishes
// every series, somebody who watches one season and leaves, and somebody who
// warms up over four years all produce the same season count and completely
// different diaries, and only the behaviours make that difference visible.
//
// Usage:
//   npx tsx scripts/seed-tv.ts
//   npx tsx scripts/seed-tv.ts --drop     # remove them again
//
// LOCAL ONLY. It writes accounts and diary rows and refuses anything but localhost.

import "./load-env.mjs";
import { and, eq, inArray, isNotNull, like, sql } from "drizzle-orm";
import { db } from "../src/db";
import { diaryEntries, films, shows, users } from "../src/db/schema";

const host = /@([^/:]+)/.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "";
if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(host)) {
  throw new Error(`Refusing to seed into "${host}". This script only runs against localhost.`);
}

const DROP = process.argv.includes("--drop");
/** Same tag the crowd seeder uses, so every tool that reads the crowd sees these too. */
const TAG = "seed-crowd";
/** Marks these fifteen specifically, so they can be dropped without touching the fifty. */
const PREFIX = "tv_";

/**
 * How somebody watches a series, which the diary records and nothing else can.
 *
 * `full` is the completionist. `first` watches a pilot season and never returns.
 * `bail` gets part way and stops. `late` warms to a show as it goes and `front`
 * cools off it, which are the same seasons rated in opposite directions.
 */
type Habit = "full" | "first" | "bail" | "late" | "front";

type Persona = {
  slug: string;
  name: string;
  /** series they watch, by name as stored */
  shows: string[];
  habit: Habit;
  /** centre of their rating distribution, in tenths */
  mean: number;
  /** how many films sit alongside the television, as a share of season count */
  filmRatio: number;
  /** rates the whole-show row as well as the seasons */
  ratesWhole?: boolean;
};

const PERSONAS: Persona[] = [
  {
    slug: "rerun", name: "Nadia Fournier", habit: "full", mean: 76, filmRatio: 0.15,
    shows: ["The Office", "Parks and Recreation", "Community", "Seinfeld", "Arrested Development", "Curb Your Enthusiasm"],
  },
  {
    slug: "prestige", name: "Douglas Merrow", habit: "full", mean: 82, filmRatio: 0.3, ratesWhole: true,
    shows: ["The Sopranos", "The Wire", "Mad Men", "Succession", "Deadwood", "Six Feet Under"],
  },
  {
    slug: "shounen", name: "Kenji Aoyama", habit: "full", mean: 79, filmRatio: 0.2,
    shows: ["Attack on Titan", "JUJUTSU KAISEN", "Demon Slayer: Kimetsu no Yaiba", "One-Punch Man", "Mob Psycho 100", "One Piece", "Chainsaw Man"],
  },
  {
    slug: "animearth", name: "Ines Barlow", habit: "full", mean: 84, filmRatio: 0.35,
    shows: ["Cowboy Bebop", "Neon Genesis Evangelion", "Monster", "Frieren: Beyond Journey's End", "Steins;Gate", "Vinland Saga", "Death Note"],
  },
  {
    slug: "latenight", name: "Reuben Tasker", habit: "full", mean: 74, filmRatio: 0.15,
    shows: ["The Simpsons", "Rick and Morty", "BoJack Horseman", "Arcane", "Avatar: The Last Airbender"],
  },
  {
    slug: "serial", name: "Petra Lindqvist", habit: "full", mean: 80, filmRatio: 0.25, ratesWhole: true,
    shows: ["Dark", "Severance", "Battlestar Galactica", "The X-Files", "The Leftovers", "Twin Peaks"],
  },
  {
    slug: "procedural", name: "Marcus Oyelaran", habit: "full", mean: 81, filmRatio: 0.3,
    shows: ["Breaking Bad", "Better Call Saul", "True Detective", "Money Heist", "The Americans", "Slow Horses"],
  },
  {
    slug: "britcom", name: "Elspeth Crane", habit: "full", mean: 78, filmRatio: 0.2,
    shows: ["Peep Show", "The Thick of It", "Fleabag", "Curb Your Enthusiasm", "The Office"],
  },
  {
    slug: "epic", name: "Halvard Sund", habit: "bail", mean: 73, filmRatio: 0.3,
    shows: ["Game of Thrones", "Andor", "Shōgun", "The Last of Us", "Buffy the Vampire Slayer"],
  },
  {
    slug: "factual", name: "Camille Osei", habit: "full", mean: 83, filmRatio: 0.4, ratesWhole: true,
    shows: ["Planet Earth", "Chef's Table", "The Rehearsal", "Chernobyl"],
  },
  {
    slug: "longrun", name: "Vernon Achebe", habit: "full", mean: 71, filmRatio: 0.1,
    shows: ["The Simpsons", "The X-Files", "One Piece", "Seinfeld", "Curb Your Enthusiasm", "Peep Show"],
  },
  {
    slug: "pilot", name: "Sasha Wren", habit: "first", mean: 68, filmRatio: 0.5,
    shows: ["Severance", "Dark", "Squid Game", "The Bear", "Ted Lasso", "Lupin", "Money Heist", "The Last of Us", "Shōgun", "Chernobyl"],
  },
  {
    slug: "bailer", name: "Otto Vance", habit: "bail", mean: 65, filmRatio: 0.45,
    shows: ["Game of Thrones", "The Walking Dead", "Buffy the Vampire Slayer", "The X-Files", "Rick and Morty", "Halt and Catch Fire"],
  },
  {
    slug: "latebloom", name: "Priya Raghunathan", habit: "late", mean: 77, filmRatio: 0.25,
    shows: ["Halt and Catch Fire", "The Americans", "BoJack Horseman", "Parks and Recreation", "Slow Horses", "Mad Men"],
  },
  {
    slug: "frontload", name: "Gideon Marsh", habit: "front", mean: 72, filmRatio: 0.3,
    shows: ["True Detective", "Westworld", "Game of Thrones", "Squid Game", "Money Heist", "The Bear"],
  },
];

/** A fixed generator, so a second run produces the same fifteen. */
let seed = 20260803;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
/** Roughly normal, from three uniforms, so ratings cluster rather than spread flat. */
const noise = () => (rnd() + rnd() + rnd() - 1.5) * 2;
const clamp = (n: number) => Math.max(10, Math.min(100, Math.round(n / 5) * 5));

const dot = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i];
  return s;
};

async function drop() {
  const doomed = await db.select({ id: users.id }).from(users).where(like(users.username, `${PREFIX}%`));
  if (doomed.length === 0) {
    console.log("  Nothing to drop.\n");
    return;
  }
  const ids = doomed.map((d) => d.id);
  await db.delete(diaryEntries).where(inArray(diaryEntries.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
  console.log(`  Dropped ${doomed.length} television accounts and their diaries.\n`);
}

/**
 * Which seasons a persona actually logged, given how they watch.
 *
 * The habit is applied per series rather than globally: somebody who abandons
 * series abandons each one at its own point, and applying one cut across the
 * whole library would produce a diary no viewer could generate.
 */
function seasonsFor<T>(habit: Habit, ordered: T[]): T[] {
  if (ordered.length === 0) return [];
  switch (habit) {
    case "first":
      return ordered.slice(0, 1);
    case "bail": {
      const keep = Math.max(1, Math.round(ordered.length * (0.3 + rnd() * 0.35)));
      return ordered.slice(0, keep);
    }
    default:
      return ordered;
  }
}

/** The drift across a run, which is the only thing separating late from front. */
function drift(habit: Habit, index: number, total: number) {
  if (total < 2) return 0;
  const through = index / (total - 1);
  if (habit === "late") return -6 + through * 14;
  if (habit === "front") return 7 - through * 15;
  return 0;
}

async function main() {
  if (DROP) {
    console.log("\n  Removing the television accounts...\n");
    await drop();
    process.exit(0);
  }

  console.log("\n  Seeding television-led accounts...\n");
  await drop();

  const allFilms = await db
    .select({ id: films.id, embedding: films.embedding })
    .from(films)
    .where(and(eq(films.kind, "movie"), isNotNull(films.embedding)));

  let madeUsers = 0;
  let rows = 0;

  for (const p of PERSONAS) {
    const [person] = await db
      .insert(users)
      .values({
        username: `${PREFIX}${p.slug}`,
        displayName: p.name,
        email: `${PREFIX}${p.slug}@seed.local`,
        passwordHash: "seeded-no-login",
        bio: TAG,
      })
      .returning();
    madeUsers++;

    const values: {
      userId: string;
      filmId: string;
      rating: number;
      watchedOn: string;
    }[] = [];
    const embeddings: number[][] = [];

    for (const name of p.shows) {
      const [show] = await db.select().from(shows).where(eq(shows.name, name)).limit(1);
      if (!show) continue;

      const ordered = await db
        .select({ id: films.id, seasonNumber: films.seasonNumber, embedding: films.embedding })
        .from(films)
        .where(and(eq(films.showId, show.id), eq(films.kind, "season")))
        .orderBy(films.seasonNumber);

      const watched = seasonsFor(p.habit, ordered);
      watched.forEach((s, i) => {
        const rating = clamp(p.mean + drift(p.habit, i, watched.length) + noise() * 3);
        values.push({
          userId: person.id,
          filmId: s.id,
          rating,
          watchedOn: new Date(Date.now() - (1 + Math.floor(rnd() * 1200)) * 86_400_000)
            .toISOString()
            .slice(0, 10),
        });
        if (s.embedding) embeddings.push(s.embedding);
      });

      // The whole-work row, for the personas who have an opinion about the
      // series rather than about its parts.
      if (p.ratesWhole && watched.length) {
        const [whole] = await db
          .select({ id: films.id })
          .from(films)
          .where(and(eq(films.showId, show.id), eq(films.kind, "show")))
          .limit(1);
        if (whole) {
          values.push({
            userId: person.id,
            filmId: whole.id,
            rating: clamp(p.mean + noise() * 2),
            watchedOn: new Date(Date.now() - (1 + Math.floor(rnd() * 600)) * 86_400_000)
              .toISOString()
              .slice(0, 10),
          });
        }
      }
    }

    // Films, chosen to agree with the television rather than at random: the
    // centroid of what they watched, then the nearest films to it.
    const wantFilms = Math.round(values.length * p.filmRatio);
    if (wantFilms > 0 && embeddings.length > 0 && allFilms.length > 0) {
      const dim = embeddings[0].length;
      const centre = new Array(dim).fill(0);
      for (const e of embeddings) for (let i = 0; i < dim; i++) centre[i] += e[i];
      const mag = Math.sqrt(centre.reduce((s, x) => s + x * x, 0)) || 1;
      for (let i = 0; i < dim; i++) centre[i] /= mag;

      const near = allFilms
        .map((f) => ({ f, z: dot(centre, f.embedding ?? []) + rnd() * 0.08 }))
        .sort((a, b) => b.z - a.z)
        .slice(0, wantFilms);

      for (const { f } of near) {
        values.push({
          userId: person.id,
          filmId: f.id,
          rating: clamp(p.mean + noise() * 3),
          watchedOn: new Date(Date.now() - (1 + Math.floor(rnd() * 1500)) * 86_400_000)
            .toISOString()
            .slice(0, 10),
        });
      }
    }

    if (values.length) {
      await db.insert(diaryEntries).values(values).onConflictDoNothing();
      rows += values.length;
    }
    process.stdout.write(`\r  ${madeUsers}/${PERSONAS.length} accounts, ${rows} ratings`);
  }

  const [mix] = (await db.execute(sql`
    select
      count(*) filter (where f.kind = 'movie')::int as films,
      count(*) filter (where f.kind = 'season')::int as seasons,
      count(*) filter (where f.kind = 'show')::int as wholes
    from diary_entries d
    join films f on f.id = d.film_id
    join users u on u.id = d.user_id
    where d.rating is not null and u.username like ${`${PREFIX}%`}
  `)) as unknown as { films: number; seasons: number; wholes: number }[];
  const tv = mix.seasons + mix.wholes;
  console.log(
    `\n\n  these fifteen: ${mix.films} films, ${mix.seasons} seasons, ${mix.wholes} whole shows ` +
      `(${Math.round((tv / Math.max(1, tv + mix.films)) * 100)}% television)\n`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
