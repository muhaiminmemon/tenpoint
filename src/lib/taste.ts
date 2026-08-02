import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { LibraryFilm } from "@/lib/library";
import { decadeLabel, formatTenths } from "@/lib/format";
import {
  archetypeMeaning,
  ARCHETYPE_BY_GENRE,
  computeTier,
  computeVariant,
  ERA_BY_DECADE,
  evaluateTraits,
  FILM_GENRES,
  nextTierMilestones,
  tasteArchetype,
  type Milestone,
  type RarityTier,
  type Trait,
  type Variant,
} from "@/lib/taste-card";
import { getTasteSignals, type TasteSignals } from "@/lib/taste-card-signals";

export type TasteProfile = {
  /** films with a rating; the basis for everything else here */
  rated: number;
  /** mean rating in tenths, or null when nothing is rated yet */
  mean: number | null;
  topGenres: { name: string; count: number }[];
  topDecade: { decade: number; count: number } | null;
  topDirector: { name: string; count: number } | null;
};

/**
 * A person in one glance, built from what they've actually rated. Counts come
 * from the current rating per film, so a rewatch never double-counts.
 */
export async function getTasteProfile(
  userId: string,
  { includePrivate = false }: { includePrivate?: boolean } = {},
): Promise<TasteProfile> {
  const privacy = includePrivate ? sql`true` : sql`private = false`;

  // one row per film: its most recent rated entry
  const current = sql`
    select distinct on (d.film_id) d.film_id, d.rating
    from diary_entries d
    where d.user_id = ${userId} and d.rating is not null and ${privacy}
    order by d.film_id, d.watched_on desc nulls last, d.created_at desc
  `;

  const summary = await db.execute(sql`
    with cur as (${current})
    select count(*)::int as rated, avg(cur.rating)::float as mean
    from cur
  `);
  const s = (summary as unknown as Record<string, unknown>[])[0];
  const rated = (s?.rated as number) ?? 0;
  const mean = rated ? Math.round(s.mean as number) : null;

  if (!rated) {
    return { rated: 0, mean: null, topGenres: [], topDecade: null, topDirector: null };
  }

  const genres = await db.execute(sql`
    with cur as (${current})
    select g.value as name, count(*)::int as count
    from cur
    join films f on f.id = cur.film_id
    cross join lateral jsonb_array_elements_text(coalesce(f.genres, '[]'::jsonb)) as g(value)
    group by g.value
    order by count desc, name asc
    limit 5
  `);

  const decades = await db.execute(sql`
    with cur as (${current})
    select (f.year / 10) * 10 as decade, count(*)::int as count
    from cur
    join films f on f.id = cur.film_id
    where f.year is not null
    group by 1
    order by count desc, decade desc
    limit 1
  `);

  // only films they rated above their own mean count as "returns to"
  const directors = await db.execute(sql`
    with cur as (${current})
    select f.director as name, count(*)::int as count
    from cur
    join films f on f.id = cur.film_id
    where f.director is not null and cur.rating >= ${mean}
    group by f.director
    having count(*) > 1
    order by count desc, name asc
    limit 1
  `);

  const g = genres as unknown as Record<string, unknown>[];
  const d = (decades as unknown as Record<string, unknown>[])[0];
  const dir = (directors as unknown as Record<string, unknown>[])[0];

  return {
    rated,
    mean,
    topGenres: g.map((r) => ({ name: r.name as string, count: r.count as number })),
    topDecade: d ? { decade: d.decade as number, count: d.count as number } : null,
    topDirector: dir ? { name: dir.name as string, count: dir.count as number } : null,
  };
}

export type MutualLove = {
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  mine: number;
  theirs: number;
};

/** Films you both rated highly: the actual common ground, not a similarity score. */
export async function getMutualLoves(
  aUserId: string,
  bUserId: string,
  { threshold = 80, limit = 6 }: { threshold?: number; limit?: number } = {},
): Promise<MutualLove[]> {
  const rows = await db.execute(sql`
    with a as (
      select distinct on (film_id) film_id, rating from diary_entries
      where user_id = ${aUserId} and rating is not null and private = false
      order by film_id, watched_on desc nulls last, created_at desc
    ),
    b as (
      select distinct on (film_id) film_id, rating from diary_entries
      where user_id = ${bUserId} and rating is not null and private = false
      order by film_id, watched_on desc nulls last, created_at desc
    )
    select f.slug, f.title, f.year, f.poster_path, a.rating as mine, b.rating as theirs
    from a
    join b on b.film_id = a.film_id
    join films f on f.id = a.film_id
    where a.rating >= ${threshold} and b.rating >= ${threshold}
    order by least(a.rating, b.rating) desc, f.title asc
    limit ${limit}
  `);

  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    slug: r.slug as string,
    title: r.title as string,
    year: r.year as number | null,
    posterPath: r.poster_path as string | null,
    mine: r.mine as number,
    theirs: r.theirs as number,
  }));
}

export type TasteMatch = { name: string; pct: number; color: string };

/**
 * Among a person's friends, who reads closest to their taste and who reads
 * furthest from it — by how far ratings on films you *both* logged tend to
 * land from each other, not by any single shared favourite.
 */
export async function getBestMatchAndRival(
  userId: string,
  friendIds: string[],
): Promise<{ bestMatch: TasteMatch; rival: TasteMatch } | null> {
  if (friendIds.length === 0) return null;
  const friendIdList = sql.join(
    friendIds.map((id) => sql`${id}`),
    sql`, `,
  );

  const rows = await db.execute(sql`
    with mine as (
      select distinct on (film_id) film_id, rating from diary_entries
      where user_id = ${userId} and rating is not null and private = false
      order by film_id, watched_on desc nulls last, created_at desc
    ),
    friend_ratings as (
      select distinct on (d.user_id, d.film_id) d.user_id, d.film_id, d.rating
      from diary_entries d
      where d.user_id in (${friendIdList}) and d.rating is not null and d.private = false
      order by d.user_id, d.film_id, d.watched_on desc nulls last, d.created_at desc
    ),
    overlap as (
      select fr.user_id, count(*)::int as common, avg(abs(fr.rating - m.rating))::float as avg_diff
      from friend_ratings fr
      join mine m on m.film_id = fr.film_id
      group by fr.user_id
      having count(*) >= 3
    )
    select u.username, u.display_name, o.avg_diff
    from overlap o
    join users u on u.id = o.user_id
    order by o.avg_diff asc
  `);

  const list = rows as unknown as Record<string, unknown>[];
  if (list.length === 0) return null;

  const toMatch = (r: Record<string, unknown>): TasteMatch => ({
    name: (r.display_name as string | null) ?? (r.username as string),
    pct: Math.max(0, Math.round(100 - (r.avg_diff as number))),
    color: "",
  });

  const best = { ...toMatch(list[0]), color: "#8faecc" };
  const worst = { ...toMatch(list[list.length - 1]), color: "#c4756a" };
  return { bestMatch: best, rival: worst };
}

// ---------------------------------------------------------------------------
// The home taste card: a collectible read on `TasteProfile` that develops as
// a person rates more. Level, tier, archetype, variant and traits all derive
// from real diary data (see taste-card.ts and taste-card-signals.ts) — there
// is no separate "game state" table to keep in sync, except the once-a-season
// binder stamp, which is a snapshot of this same derivation.

export type SignatureFilm = {
  slug: string;
  title: string;
  posterPath: string | null;
  rating: number;
};

export type DecadeShare = { decade: number; count: number; pct: number };
export type Stat = { label: string; value: string };
/**
 * One reading of how someone rates, as a share of a stated denominator.
 *
 * Every one of these is a real proportion of real films, so the number can be
 * checked against the library by hand. `pct` is null when the metadata the
 * reading needs is too thin to divide by, and `meaning` states exactly what
 * was counted, which is what the binder prints.
 */
export type PersonalityTrait = {
  label: string;
  /** this reading's share of the whole profile; across a profile these sum to exactly 100 */
  pct: number;
  /** the reading on its own terms, as a share of the films it was counted from */
  rawPct: number;
  /** the exact films behind it, e.g. "113 of 246 rated films" */
  basis: string;
  /** the rule, in the reader's own terms */
  meaning: string;
};

/**
 * How many films have to sit behind a reading before it is one.
 *
 * Three, the same floor `topRatedDecade` already uses to decide a decade can
 * be your highest-rated. Two long films is an accident of what was on; three
 * is the beginning of a habit.
 */
const READING_FLOOR = 3;

/**
 * How much of the library must carry a field before a reading may divide by
 * it. TMDB metadata arrives lazily, so a reading taken from the hydrated few
 * describes them rather than the person.
 */
const COVERAGE_FLOOR = 0.5;
const COVERAGE_MIN_FILMS = 20;

/** The 1900s through the 2020s: the decades a film can plausibly sit in. */
const DECADES_ON_THE_MAP = 13;

/**
 * Every reading of how someone rates that their library actually produced.
 *
 * Pure, and the single source for both the card and the binder: the binder
 * exists to explain the number the card shows, so the two computing it
 * separately is the one way this feature could start lying.
 *
 * Two rules decide what comes back, and both are about not overstating:
 *
 * - Every reading is a share of a stated denominator, and that denominator is
 *   the films that actually carry the field it needs. This rules out an index
 *   on an invented scale, and rules out reporting "not hydrated yet" as a fact
 *   about taste.
 * - A reading with fewer than `READING_FLOOR` films behind it is not returned
 *   at all. It is not shown greyed, listed as missing, or counted against a
 *   total, because a reading is a description rather than something to
 *   collect: the ones that don't describe you are simply not about you. It
 *   also means this can never become a list of things to go and earn.
 */
export function computePersonality(
  taste: TasteProfile,
  signals: TasteSignals,
): PersonalityTrait[] {
  const rated = taste.rated;

  /** A reading is only honest if enough of the library carries the field. */
  const covered = (known: number) =>
    known >= COVERAGE_MIN_FILMS && rated > 0 && known / rated >= COVERAGE_FLOOR;

  const readings: (Omit<PersonalityTrait, "pct"> & { weight: number })[] = [];
  const add = (label: string, count: number, of: number, unit: string, meaning: string) => {
    if (of <= 0 || count < READING_FLOOR) return;
    const rawPct = Math.min(100, Math.round((count / of) * 100));
    readings.push({
      label,
      rawPct,
      weight: count / of,
      basis: `${count} of ${of} ${unit}`,
      meaning,
    });
  };

  const films = "rated films";
  const viewings = "logged viewings";

  // --- how the scale itself gets used: true of anyone who rates at all ---
  add("Optimism", signals.positiveCount, rated, films, "Ratings that reach 7.0.");
  add(
    "Consistency",
    signals.nearMeanCount,
    rated,
    films,
    "Ratings landing within 1.0 of your own average.",
  );
  add(
    "Hot-take",
    signals.perfectTenCount + signals.toughCriticCount,
    rated,
    films,
    "Ratings at the ends of the scale: a flat 10.0, or 3.0 and below.",
  );
  add(
    "Precisionist",
    signals.decimalRatingCount,
    rated,
    films,
    "Ratings that land off the round point, using the tenths rather than the whole number.",
  );
  add(
    "Perfectionist",
    signals.perfectTenCount,
    rated,
    films,
    "Ratings that are a flat 10.0.",
  );

  // --- what the diary says about how you watch ---
  add(
    "Rewatcher",
    signals.rewatchEntryCount,
    signals.totalEntryCount,
    viewings,
    "Viewings that are rewatches rather than first times.",
  );
  add(
    "Critic",
    signals.reviewCount,
    signals.totalEntryCount,
    viewings,
    "Viewings you wrote something about.",
  );
  add(
    "Curator",
    signals.favouriteCount,
    rated,
    films,
    "Rated films you also marked a favourite.",
  );

  // --- breadth, which needs the metadata to be there to mean anything ---
  if (covered(signals.genreTaggedCount)) {
    add(
      "Explorer",
      signals.distinctGenres,
      FILM_GENRES.length,
      "genres a film can carry",
      "How much of the map you have been on.",
    );
    const topGenre = taste.topGenres[0];
    if (topGenre) {
      add(
        "Specialist",
        topGenre.count,
        signals.genreTaggedCount,
        "genre-tagged films",
        `Films carrying ${topGenre.name}, the genre that leads your ratings.`,
      );
    }
  }

  if (covered(signals.yearKnownCount)) {
    add(
      "Range",
      signals.distinctDecades,
      DECADES_ON_THE_MAP,
      "decades from the 1900s on",
      "Decades of film you have rated in.",
    );
    add(
      "Archivist",
      signals.preSeventyCount,
      signals.yearKnownCount,
      "dated films",
      "Films released before 1970.",
    );
    add(
      "Modernist",
      signals.modernCount,
      signals.yearKnownCount,
      "dated films",
      "Films released in 2010 or later.",
    );
  }

  if (covered(signals.runtimeKnownCount)) {
    add(
      "Marathoner",
      signals.longFilmCount,
      signals.runtimeKnownCount,
      "timed films",
      "Films running 150 minutes or more.",
    );
    add(
      "Sprinter",
      signals.shortFilmCount,
      signals.runtimeKnownCount,
      "timed films",
      "Films running 85 minutes or less.",
    );
  }

  if (covered(signals.directorKnownCount)) {
    add(
      "Loyalist",
      signals.loyalDirectorFilmCount,
      signals.directorKnownCount,
      "credited films",
      "Films by a director you have rated three or more times.",
    );
  }

  if (covered(signals.voteKnownCount)) {
    add(
      "Populist",
      signals.mainstreamCount,
      signals.voteKnownCount,
      "films with vote counts on file",
      "Films that are widely seen, at 1,000 votes or more.",
    );
  }

  return asProfileShares(readings);
}

/**
 * Turns the readings into one profile: each reading's weight over the sum of
 * them all, so the set totals exactly 100.
 *
 * The rounding is largest-remainder rather than per-value `Math.round`, which
 * would land on 99 or 101 about as often as not. A profile that does not add
 * up is the whole reason this function exists.
 *
 * Note what the resulting number is and isn't. `pct` is a share of the profile
 * and is not a proportion of any set of films: "Optimism 14%" does not mean
 * 14% of anything you watched. That is why `rawPct` and `basis` travel with
 * it, and why every surface prints them together — the composition is what
 * sums to 100, and the count underneath is what can be checked.
 */
function asProfileShares(
  readings: (Omit<PersonalityTrait, "pct"> & { weight: number })[],
): PersonalityTrait[] {
  const total = readings.reduce((sum, r) => sum + r.weight, 0);
  if (total <= 0) return [];

  const exact = readings.map((r) => (r.weight / total) * 100);
  const pcts = exact.map(Math.floor);
  const short = 100 - pcts.reduce((a, b) => a + b, 0);

  // The leftover points go to the readings the floor cost the most, so the
  // ordering of the profile is never decided by rounding luck.
  Array.from(exact.keys())
    .sort((a, b) => exact[b] - Math.floor(exact[b]) - (exact[a] - Math.floor(exact[a])))
    .slice(0, short)
    .forEach((i) => pcts[i]++);

  return readings
    .map((r, i) => ({
      label: r.label,
      pct: pcts[i],
      rawPct: r.rawPct,
      basis: r.basis,
      meaning: r.meaning,
    }))
    .sort((a, b) => b.pct - a.pct || a.label.localeCompare(b.label));
}

export type HomeTasteCardData = TasteProfile & {
  /** null until 5 films are rated — there isn't enough signal to name a class before that */
  archetype: string | null;
  /** the plain sentence naming the decade and genre the title came from */
  archetypeMeaning: string;
  /** the full tiered, flippable card takes over at this threshold */
  full: boolean;
  /** how many more ratings unlock the full card; 0 once `full` is true */
  toFull: number;
  tier: RarityTier;
  milestones: { milestones: Milestone[]; met: number; nextTier: RarityTier | null } | null;
  variant: Variant;
  traits: Trait[];
  traitsHeldCount: number;
  traitsTotal: number;
  traitsHidden: number;
  signatureFilms: SignatureFilm[];
  decadeBreakdown: DecadeShare[];
  /** every rated tenths value, for the rating-fingerprint histogram on the back */
  ratings: number[];
  profStats: Stat[];
  personality: PersonalityTrait[];
  /**
   * Share of the library that is widely seen, or null when too little of it
   * has vote data on file to say. Never a figure derived from unknowns.
   */
  mainstreamPct: number | null;
  indiePct: number | null;
  favsCard: Stat[];
  social: TasteMatch[];
  /** the "regular" home hero panel: films / hours / home decade / this year */
  heroStats: Stat[];
  genreShare: { name: string; pct: number }[];
};

/** the point at which the archetype names itself */
export const CLASS_THRESHOLD = 5;
/** the point at which the full flippable, tiered card replaces the developing placeholder */
export const FULL_CARD_THRESHOLD = 8;

function runtimeBand(avgMinutes: number): string {
  const lo = Math.max(0, Math.round(avgMinutes / 10) * 10 - 15);
  const hi = Math.round(avgMinutes / 10) * 10 + 15;
  return `${lo}–${hi}m`;
}

/**
 * Builds the full home-page card: fetches the raw signal counts, stamps this
 * season's snapshot into the binder the first time it's asked for this
 * season, and derives everything else (tier, archetype, variant, traits,
 * milestones, personality) in plain JS from real data.
 */
export async function buildHomeTasteCard(
  userId: string,
  taste: TasteProfile,
  library: LibraryFilm[],
  friendIds: string[],
  { includePrivate = false }: { includePrivate?: boolean } = {},
): Promise<HomeTasteCardData> {
  const ratedFilms = library.filter((f) => f.rating !== null) as (LibraryFilm & { rating: number })[];

  const signatureFilms: SignatureFilm[] = ratedFilms.slice(0, 4).map((f) => ({
    slug: f.slug,
    title: f.title,
    posterPath: f.posterPath,
    rating: f.rating,
  }));

  const decadeCounts = new Map<number, number>();
  for (const f of ratedFilms) {
    if (f.year === null) continue;
    const decade = Math.floor(f.year / 10) * 10;
    decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
  }
  const decadeTotal = [...decadeCounts.values()].reduce((s, n) => s + n, 0);
  const decadeBreakdown: DecadeShare[] = [...decadeCounts.entries()]
    .map(([decade, count]) => ({ decade, count, pct: Math.round((count / decadeTotal) * 100) }))
    .sort((a, b) => b.count - a.count || b.decade - a.decade)
    .slice(0, 4);

  const full = taste.rated >= FULL_CARD_THRESHOLD;
  const archetype = taste.rated >= CLASS_THRESHOLD ? tasteArchetype(taste.topDecade, taste.topGenres[0]) : null;

  if (taste.rated === 0) {
    return {
      ...taste,
      archetype: null,
      archetypeMeaning: "",
      full,
      toFull: FULL_CARD_THRESHOLD,
      // Nothing rated means nothing met, so this is Common without asking.
      tier: computeTier(0),
      milestones: null,
      variant: { name: "", stock: "", accent: "", aura: "", accentColor: "#8faecc" },
      traits: [],
      traitsHeldCount: 0,
      traitsTotal: 0,
      traitsHidden: 0,
      signatureFilms,
      decadeBreakdown,
      ratings: [],
      profStats: [],
      personality: [],
      mainstreamPct: null,
      indiePct: null,
      favsCard: [],
      social: [],
      heroStats: [],
      genreShare: [],
    };
  }

  const [signals, match] = await Promise.all([
    getTasteSignals(userId, { includePrivate }),
    getBestMatchAndRival(userId, friendIds),
  ]);

  // Computed here rather than above, because the milestones are half the
  // answer and they need the signals.
  const tier = computeTier(taste.rated, signals);

  const variant = computeVariant(
    taste.topGenres[0]?.name,
    signals.topRatedDecade,
    taste.topDecade?.decade ?? null,
    taste.mean,
  );

  const traits = evaluateTraits(signals);
  const heldTraits = traits.filter((t) => t.held);

  const rewatchPct = taste.rated ? Math.round((signals.rewatchEntryCount / taste.rated) * 100) : 0;

  // Divided by the films whose vote data is actually on file, the same rule
  // `genreShare` uses below — TMDB metadata is hydrated lazily, so most of a
  // freshly imported library has no vote count yet, and dividing by every
  // rated film reported "not known" as "indie". It is also suppressed
  // outright unless enough of the library is known to make the split mean
  // anything: hydrated films are the ones whose pages got opened, which is a
  // biased sample, so a sliver of coverage cannot speak for the whole shelf.
  const voteCoverage = taste.rated ? signals.voteKnownCount / taste.rated : 0;
  const splitIsHonest = signals.voteKnownCount >= 20 && voteCoverage >= 0.5;
  const mainstreamPct = splitIsHonest
    ? Math.round((signals.mainstreamCount / signals.voteKnownCount) * 100)
    : null;

  return {
    ...taste,
    archetype,
    archetypeMeaning: archetypeMeaning(taste.topDecade?.decade ?? null, taste.topGenres[0]?.name),
    full,
    toFull: Math.max(0, FULL_CARD_THRESHOLD - taste.rated),
    tier,
    milestones: nextTierMilestones(tier, signals),
    variant,
    traits,
    traitsHeldCount: heldTraits.length,
    traitsTotal: traits.length,
    traitsHidden: traits.length - heldTraits.length,
    signatureFilms,
    decadeBreakdown,
    ratings: ratedFilms.map((f) => f.rating),
    profStats: [
      { label: "Films", value: String(taste.rated) },
      { label: "Avg", value: taste.mean !== null ? formatTenths(taste.mean) : "—" },
      { label: "Rewatch", value: `${rewatchPct}%` },
      { label: "Reviews", value: String(signals.reviewCount) },
      { label: "Decades", value: String(signals.distinctDecades) },
    ],
    personality: computePersonality(taste, signals),
    mainstreamPct,
    indiePct: mainstreamPct === null ? null : 100 - mainstreamPct,
    favsCard: [
      { label: "Director", value: taste.topDirector?.name ?? "—" },
      { label: "Decade", value: taste.topDecade ? decadeLabel(taste.topDecade.decade) : "—" },
      { label: "Runtime", value: signals.avgRuntime ? runtimeBand(signals.avgRuntime) : "—" },
    ],
    social: match ? [match.bestMatch, match.rival] : [],
    heroStats: [
      { label: "Films logged", value: String(taste.rated) },
      { label: "Hours logged", value: String(Math.round(signals.totalRuntimeMinutes / 60)) },
      { label: "Home decade", value: taste.topDecade ? decadeLabel(taste.topDecade.decade) : "—" },
      { label: "Reviews", value: String(signals.reviewCount) },
    ],
    // share of *tagged* films, not all rated films — most libraries have gaps
    // in genre metadata, and dividing by the untagged total makes an honest
    // top genre read as a sliver
    genreShare: taste.topGenres.map((g) => ({
      name: g.name,
      pct: signals.genreTaggedCount ? Math.round((g.count / signals.genreTaggedCount) * 100) : 0,
    })),
  };
}

export { ERA_BY_DECADE, ARCHETYPE_BY_GENRE };
