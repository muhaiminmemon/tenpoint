/**
 * Running a browse query. Split from `browse.ts` because this half reaches the
 * database and TMDB, and the filter bar is a client component: importing the
 * two together dragged `postgres` into the browser bundle and the build
 * refused it. Constants and URL parsing stay pure; anything that fetches lives
 * here.
 */
import { and, desc, gte, isNotNull, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { films } from "@/db/schema";
import {
  discoverMovies,
  searchMovies,
  searchPeople,
  type DiscoverPage,
  type TmdbMovie,
} from "./tmdb";
import {
  BROWSE_GENRES,
  RUNTIMES,
  SORTS,
  normalise,
  type BrowseFilters,
  type QueryAs,
} from "./browse";

/**
 * A vote floor, applied to every query and raised for rating sorts.
 *
 * `vote_average.desc` with no floor is the classic way to get a useless list:
 * films with two votes averaging 10.0 outrank everything ever made. The floor
 * is what makes "highest rated" mean anything at all.
 */
function voteFloor(f: BrowseFilters): number {
  if (f.sort === "rated" || f.minRating !== null) return 300;
  return 30;
}

/**
 * A film in a grid, carrying the number that grid is ordered by.
 *
 * Whichever ranking is in force, the tile shows its own score — otherwise a
 * reader is asked to trust an ordering they cannot see. Formatted here rather
 * than in the component because only this layer knows which scale it came
 * from: tenths for IMDb, a percentage for the Tomatometer.
 */
export type BrowseFilm = TmdbMovie & { score?: string };

export type BrowseResult = {
  results: BrowseFilm[];
  page: number;
  totalPages: number;
  totalResults: number;
  /** what a typed query turned out to mean, when there was one */
  match?: QueryMatch;
};

/**
 * The reading the page took of what somebody typed, and its receipt.
 *
 * A search box that silently decides "Kubrick" means the director is right
 * almost every time and infuriating the once it is not. Every field here
 * exists so the page can say what it did and offer the other reading in one
 * click.
 */
export type QueryMatch = {
  kind: QueryAs;
  /** the heading: "Films with Christopher Nolan", "Titles matching alien" */
  heading: string;
  /** the reading not taken, when it would return anything */
  otherLabel?: string;
  other?: QueryAs;
  /** filters this reading could not honour, named so nobody hunts for them */
  dropped?: string[];
};

export async function runBrowse(f: BrowseFilters): Promise<BrowseResult> {
  const filters = normalise(f);
  if (filters.source !== "tmdb") return runLeaderboard(filters);
  return filters.q ? runQuery(filters) : runTmdb(filters);
}

/** Accents off, punctuation off, case off: how two names are compared. */
function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Whether a typed string is a person or a title.
 *
 * Both readings are asked for at once and the stronger one wins, because
 * neither alone is enough. "Kubrick" is a director and also a documentary
 * called Kubrick; "Alien" is a film and also somebody's actual name. So a
 * person has to be genuinely well known, and a film sharing the spelling only
 * takes precedence when it is a film people have heard of. The vote floor is
 * what separates Ridley Scott's Alien from an obscure short of the same name.
 */
async function resolveQuery(q: string, forced: QueryAs | null) {
  const nq = fold(q);
  const [people, titles] = await Promise.all([
    searchPeople(q).catch(() => []),
    searchMovies(q).catch(() => []),
  ]);

  const person = people[0];
  const namedExactly = person
    ? (() => {
        const n = fold(person.name);
        return n === nq || n.split(" ").includes(nq) || n.startsWith(nq);
      })()
    : false;
  const wellKnown = (person?.popularity ?? 0) >= 2;

  const sameName = titles
    .slice(0, 6)
    .filter((m) => fold(m.title) === nq)
    .reduce((max, m) => Math.max(max, m.vote_count ?? 0), 0);

  const personFits = Boolean(person) && namedExactly && wellKnown;
  const kind: QueryAs =
    forced ?? (personFits && sameName < 400 ? "person" : "title");

  return { kind, person: personFits ? person : undefined, titles };
}

/**
 * A text query against TMDB's whole index.
 *
 * The person reading runs through `/discover` with `with_people`, which is why
 * it is worth resolving names at all: every filter and every sort keeps
 * working, the counts are real and the pages go as deep as anything else. The
 * title reading has to use `/search`, which honours a year and nothing else,
 * so the rest are applied to what comes back and the ones that cannot be are
 * named rather than quietly ignored.
 */
async function runQuery(f: BrowseFilters): Promise<BrowseResult> {
  const { kind, person, titles } = await resolveQuery(f.q, f.as);

  if (kind === "person" && person) {
    const page = await runTmdb(f, { with_people: String(person.id) });
    const role =
      person.known_for_department === "Directing"
        ? "director"
        : person.known_for_department === "Writing"
          ? "writer"
          : "actor";
    return {
      ...page,
      match: {
        kind: "person",
        heading: `Films with ${person.name}, ${role}`,
        other: titles.length ? "title" : undefined,
        otherLabel: titles.length ? "Search titles instead" : undefined,
      },
    };
  }

  const found = await searchMovies(f.q, f.year ?? undefined);
  const band = RUNTIMES.find((r) => r.key === f.runtime);
  const dropped: string[] = [];
  if (band) dropped.push("runtime");

  const results = found.filter((m) => {
    if (f.genre && !(m.genre_ids ?? []).includes(f.genre)) return false;
    if (f.language && m.original_language !== f.language) return false;
    if (f.minRating && (m.vote_average ?? 0) * 10 < f.minRating) return false;
    if (f.decade && !f.year) {
      const y = Number.parseInt((m.release_date ?? "").slice(0, 4), 10);
      if (!Number.isFinite(y) || y < f.decade || y > f.decade + 9) return false;
    }
    return true;
  });

  return {
    results: results.map((m) => ({
      ...m,
      score:
        typeof m.vote_average === "number" && m.vote_average > 0
          ? m.vote_average.toFixed(1)
          : undefined,
    })),
    page: 1,
    // Relevance order is the answer to a title search, and there is no second
    // page of it worth walking: past the first twenty, a search that has not
    // found the film needs different words rather than another page.
    totalPages: 1,
    totalResults: results.length,
    match: {
      kind: "title",
      heading: `Titles matching \u201c${f.q}\u201d`,
      other: person ? "person" : undefined,
      otherLabel: person ? `Search for ${person.name} instead` : undefined,
      dropped: dropped.length ? dropped : undefined,
    },
  };
}

async function runTmdb(
  f: BrowseFilters,
  extra: Record<string, string> = {},
): Promise<DiscoverPage> {
  const sort = SORTS.find((s) => s.key === f.sort) ?? SORTS[0];

  const params: Record<string, string> = {
    sort_by: sort.tmdb,
    page: String(f.page),
    // A person's filmography is a few dozen films, not a chart: the floor that
    // keeps a chart honest would hide half of it.
    "vote_count.gte": String(extra.with_people ? 0 : voteFloor(f)),
    ...extra,
  };

  if (f.genre) params.with_genres = String(f.genre);
  if (f.language) params.with_original_language = f.language;

  const band = RUNTIMES.find((r) => r.key === f.runtime);
  if (band?.gte) params["with_runtime.gte"] = String(band.gte);
  if (band?.lte) params["with_runtime.lte"] = String(band.lte);

  if (f.year) {
    params.primary_release_year = String(f.year);
  } else if (f.decade) {
    params["primary_release_date.gte"] = `${f.decade}-01-01`;
    params["primary_release_date.lte"] = `${f.decade + 9}-12-31`;
  } else if (f.sort === "new") {
    // Sorting by newest without a ceiling returns films announced but not out,
    // most with no poster and nothing to say about them.
    params["primary_release_date.lte"] = new Date().toISOString().slice(0, 10);
  }

  if (f.minRating) params["vote_average.gte"] = String(f.minRating / 10);

  const page = await discoverMovies(params);
  return {
    ...page,
    results: page.results.map((m) => ({
      ...m,
      score: typeof m.vote_average === "number" && m.vote_average > 0
        ? m.vote_average.toFixed(1)
        : undefined,
    })),
  };
}

const LEADERBOARD_PER_PAGE = 24;

/**
 * The critic leaderboards, read from the local catalogue.
 *
 * These cannot run against TMDB, which holds no IMDb or Rotten Tomatoes data
 * at all, so they are ordered over scores the backfill has already fetched.
 * That makes them a ranking of what we hold rather than of everything, which
 * is why the page says so rather than implying otherwise.
 */
async function runLeaderboard(f: BrowseFilters): Promise<BrowseResult> {
  const column = f.source === "imdb" ? films.imdbRating : films.rtScore;

  const where: SQL[] = [isNotNull(column)];
  if (f.genre) {
    const name = BROWSE_GENRES.find((g) => g.id === f.genre)?.name;
    if (name) where.push(sql`${films.genres} @> ${JSON.stringify([name])}::jsonb`);
  }
  if (f.year) {
    where.push(sql`${films.year} = ${f.year}`);
  } else if (f.decade) {
    where.push(gte(films.year, f.decade), lte(films.year, f.decade + 9));
  }
  const band = RUNTIMES.find((r) => r.key === f.runtime);
  if (band?.gte) where.push(gte(films.runtime, band.gte));
  if (band?.lte) where.push(lte(films.runtime, band.lte));
  if (f.language) where.push(sql`${films.originalLanguage} = ${f.language}`);
  if (f.q) {
    // One condition over all three fields, which is the whole advantage of
    // ranking locally: TMDB needs a name resolved to an id before it can be
    // asked about, and this table already holds who directed and who is in
    // every film it ranks.
    const like = `%${f.q}%`;
    where.push(sql`(
      ${films.title} ilike ${like}
      or ${films.director} ilike ${like}
      or exists (
        -- guarded: jsonb_array_elements_text raises on a row holding anything
        -- but an array, and one such row would fail the whole query
        select 1 from jsonb_array_elements_text(
          case when jsonb_typeof(${films.castNames}) = 'array'
               then ${films.castNames} else '[]'::jsonb end
        ) as c
        where c ilike ${like}
      )
    )`);
  }
  // Both scales happen to land on 0–100: IMDb is stored in tenths (8.8 → 88)
  // and the Tomatometer is already a percentage, so one comparison covers both.
  if (f.minRating) where.push(gte(column, f.minRating));

  const clause = and(...where);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(films)
    .where(clause);

  const rows = await db
    .select({
      tmdbId: films.tmdbId,
      title: films.title,
      posterPath: films.posterPath,
      year: films.year,
      score: column,
    })
    .from(films)
    .where(clause)
    .orderBy(desc(column), films.title)
    .limit(LEADERBOARD_PER_PAGE)
    .offset((f.page - 1) * LEADERBOARD_PER_PAGE);

  return {
    results: rows
      .filter((r) => r.tmdbId !== null)
      .map((r) => ({
        id: r.tmdbId as number,
        title: r.title,
        poster_path: r.posterPath,
        release_date: r.year ? `${r.year}-01-01` : undefined,
        // IMDb is stored in tenths, the Tomatometer as a whole percentage.
        score:
          r.score === null
            ? undefined
            : f.source === "imdb"
              ? (r.score / 10).toFixed(1)
              : `${r.score}%`,
      })),
    page: f.page,
    totalPages: Math.max(1, Math.ceil(count / LEADERBOARD_PER_PAGE)),
    totalResults: count,
    match: f.q
      ? { kind: "title", heading: `Matching \u201c${f.q}\u201d in title, director or cast` }
      : undefined,
  };
}
