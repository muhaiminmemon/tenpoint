import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { LibraryFilm } from "@/lib/library";
import { decadeLabel, formatTenths } from "@/lib/format";
import { CLUSTERS, CLUSTER_PREVALENCE } from "@/lib/archetype-clusters";
import { pickSignatureFilms } from "@/lib/signature-films";
import {
  readArchetype,
  themeDNA,
  ARCHETYPE_BY_GENRE,
  computeTier,
  computeVariant,
  ERA_BY_DECADE,
  evaluateTraits,
  tierStanding,
  weightedSize,
  RARITY_TIERS,
  type RarityTier,
  type TierStanding,
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

export type TasteMatch = {
  name: string;
  pct: number;
  color: string;
  /** what the figure was read from, so it is never an unexplained score */
  basis: string;
};

/**
 * Who among your friends reads closest to your taste, and who reads furthest.
 *
 * This used to be one thing only: the average gap between your ratings on
 * films you had both logged. That measure has two holes. It needs an overlap
 * to exist at all, so two people whose libraries are made of the same themes
 * and none of the same titles scored nothing; and it was reported as
 * `100 - avg_gap`, which is not a percentage of anything, and which parks
 * everybody between 85 and 95 because rating gaps are small numbers.
 *
 * Now it reads both halves of what "alike" means. Agreement is still the gap
 * on shared films, and it still counts for most, because two people who watch
 * the same things and disagree about them are not alike. Affinity is the angle
 * between your two libraries once each is described as shares of the same
 * forty-three themes, which needs no overlap at all: it is the part that can
 * say "you two are both drawn to heists" about people who have never rated the
 * same film.
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
    )
    select u.id, u.username, u.display_name, o.common, o.avg_diff
    from users u
    left join overlap o on o.user_id = u.id
    where u.id in (${friendIdList})
  `);

  const list = rows as unknown as Record<string, unknown>[];
  if (list.length === 0) return null;

  const mine = await themeShares(userId);
  const theirs = await Promise.all(
    list.map(async (r) => ({ id: r.id as string, shares: await themeShares(r.id as string) })),
  );
  const sharesById = new Map(theirs.map((t) => [t.id, t.shares]));

  const scored = list.map((r) => {
    const common = (r.common as number | null) ?? 0;
    const affinity = cosine(mine, sharesById.get(r.id as string) ?? {});

    // Agreement, expressed as a share of the scale rather than as
    // `100 - gap`. A whole point apart on a ten-point scale is 10% apart,
    // which is what this now says.
    const agreement =
      common >= 5 && r.avg_diff !== null
        ? Math.max(0, 1 - (r.avg_diff as number) / 100)
        : null;

    // Agreement carries it when there is enough of it, because agreeing about
    // the same films is the stronger claim. Themes fill in when there is not.
    const pct =
      agreement === null
        ? Math.round(affinity * 100)
        : Math.round((agreement * 0.65 + affinity * 0.35) * 100);

    const basis =
      agreement === null
        ? `Read from what is unusual about each of your libraries. ${common} films in common.`
        : `${common} films in common, ${((r.avg_diff as number) / 10).toFixed(1)} apart on average.`;

    return {
      name: (r.display_name as string | null) ?? (r.username as string),
      pct: Math.max(0, Math.min(100, pct)),
      color: "",
      basis,
      common,
    };
  });

  scored.sort((a, b) => b.pct - a.pct);
  const best = { ...scored[0], color: "#8faecc" };

  // Shown whenever there is somebody else to name. The only case still held
  // back is a single friend, where the closest and the furthest would be the
  // same person and the card would print them twice.
  const last = scored[scored.length - 1];
  const rival = scored.length >= 2 ? { ...last, color: "#c4756a" } : null;

  return { bestMatch: best, rival: rival ?? best };
}

/**
 * How many films to add of the ordinary library before a share is believed.
 *
 * Without it a small library dominates: four folk-horror films out of
 * twenty-nine is 14% against a catalogue norm of 7%, which reads as twice as
 * obsessed as somebody with forty of them out of three hundred. Pulling every
 * share toward typical in proportion to how little evidence there is stops a
 * thin library from out-shouting a thick one, in either direction.
 */
const SHARE_PRIOR = 10;

/** A library as shares of the forty-three themes, for comparing two of them. */
async function themeShares(userId: string): Promise<Record<string, number>> {
  const rows = await db.execute(sql`
    with cur as (
      select distinct on (d.film_id) d.film_id
      from diary_entries d
      where d.user_id = ${userId} and d.rating is not null and d.private = false
      order by d.film_id, d.watched_on desc nulls last, d.created_at desc
    )
    select f.keywords from cur join films f on f.id = cur.film_id
    where jsonb_typeof(f.keywords) = 'array' and jsonb_array_length(f.keywords) > 0
  `);

  const counts: Record<string, number> = {};
  let films = 0;
  for (const row of rows as unknown as Record<string, unknown>[]) {
    films++;
    const held = new Set((row.keywords as string[]).map((k: string) => k.toLowerCase()));
    for (const c of CLUSTERS) {
      if (c.keywords.some((k) => held.has(k))) counts[c.key] = (counts[c.key] ?? 0) + 1;
    }
  }
  if (films === 0) return {};

  const shares: Record<string, number> = {};
  for (const c of CLUSTERS) {
    const prev = CLUSTER_PREVALENCE[c.key] ?? 0.05;
    shares[c.key] = ((counts[c.key] ?? 0) + SHARE_PRIOR * prev) / (films + SHARE_PRIOR);
  }
  return shares;
}

/**
 * How alike two libraries are, measured on what makes each unusual.
 *
 * Cosine on raw shares was nearly useless: every library carries some
 * superheroes, some family drama, some crime, so four accounts came out
 * between 72% and 84% of each other and the figure could not tell anybody
 * apart. Sharing the things everybody shares is not a resemblance.
 *
 * Each share is therefore measured against what an ordinary library holds
 * first, and the angle is taken between the two remainders. Now it is a
 * comparison of what is distinctive about each person, it spans the whole
 * range instead of a twelfth of it, and it can go properly negative: two
 * people who over-index on opposite things are genuinely far apart, which is
 * what "furthest" is supposed to mean.
 *
 * Still scale-free. A thirty-film library and a three-hundred-film one that
 * lean the same way read as alike, because the angle between two directions
 * says nothing about how long either arrow is.
 */
function cosine(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const c of CLUSTERS) {
    const typical = CLUSTER_PREVALENCE[c.key] ?? 0.05;
    const x = (a[c.key] ?? typical) - typical;
    const y = (b[c.key] ?? typical) - typical;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  // −1 is opposite taste, 0 unrelated, 1 identical. Folded onto 0..1 so the
  // blend below never has to reason about a negative share.
  return (dot / Math.sqrt(na * nb) + 1) / 2;
}

// ---------------------------------------------------------------------------
// The home taste card: a collectible read on `TasteProfile` that develops as
// a person rates more. Level, tier, archetype, variant and traits all derive
// from real diary data (see taste-card.ts and taste-card-signals.ts) — there
// is no separate "game state" table to keep in sync, except the once-a-season
// binder stamp, which is a snapshot of this same derivation.

export type { SignatureFilm } from "./signature-films";
import type { SignatureFilm } from "./signature-films";

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
/**
 * One band of a profile: a slice of a stated whole.
 *
 * `count` is what it is a count of, so the figure on screen can be checked
 * against the library rather than taken on trust.
 */
export type PersonalityBand = {
  label: string;
  /** share of this axis, as a whole number; the bands of an axis sum to 100 */
  pct: number;
  count: number;
};

/**
 * One reading of how somebody watches, as a partition.
 *
 * The old model was sixteen overlapping readings (Optimism, Rewatcher,
 * Marathoner) divided by each other to force a total of 100. Nothing was a
 * share of anything real: a film could be counted by five of them, so
 * "Optimism 11%" was 11% of no set of films that exists, and the same reading
 * printed 62% on the card and 11% in the binder because the two surfaces
 * showed different halves of the fudge.
 *
 * A partition fixes it at the root. Every film that carries the field falls
 * into exactly one band, so the shares add to 100 because they are shares,
 * not because they were scaled until they did. Every number is then the same
 * number everywhere it appears, and it means one plain thing: this many of
 * your films, out of this many.
 */
export type PersonalityAxis = {
  key: string;
  /** the question the axis answers, e.g. "How you rate" */
  title: string;
  /** the axis in one plain sentence */
  note: string;
  /** what the bands are shares of, e.g. "246 rated films" */
  basis: string;
  bands: PersonalityBand[];
};

/**
 * How much of the library must carry a field before an axis is drawn.
 *
 * TMDB metadata arrives lazily, so an axis taken from the hydrated few
 * describes them rather than the person.
 */
const COVERAGE_FLOOR = 0.5;
const COVERAGE_MIN_FILMS = 20;

/**
 * Every axis the library actually supports.
 *
 * Pure, and the single source for both the card and the binder: the binder
 * exists to explain the numbers the card shows, and the two computing them
 * separately is exactly how they came to disagree.
 *
 * An axis with too little behind it is not returned at all. It is not shown
 * empty, greyed, or as something to go and earn: an axis nobody's library
 * supports is not a fact about them.
 */
export function computePersonality(
  taste: TasteProfile,
  signals: TasteSignals,
): PersonalityAxis[] {
  const rated = taste.rated;
  const covered = (known: number) =>
    known >= COVERAGE_MIN_FILMS && rated > 0 && known / rated >= COVERAGE_FLOOR;

  const out: PersonalityAxis[] = [];
  const axis = (
    key: string,
    title: string,
    note: string,
    unit: string,
    labels: string[],
    counts: number[],
  ) => {
    const total = counts.reduce((a, b) => a + b, 0);
    if (total < COVERAGE_MIN_FILMS) return;
    out.push({
      key,
      title,
      note,
      basis: `${total} ${unit}`,
      bands: shareOut(labels, counts, total),
    });
  };

  axis(
    "rating",
    "How you rate",
    "Where your ratings land. Everyone's shape is different: some libraries are nearly all sevens and eights, some use the whole scale.",
    rated === 1 ? "rated film" : "rated films",
    ["Loved, 8.5 and up", "Liked, 7.0 to 8.4", "Fair, 5.5 to 6.9", "Didn't work, under 5.5"],
    signals.ratingBands,
  );

  if (covered(signals.yearKnownCount)) {
    axis(
      "era",
      "When your films are from",
      "The years your library is drawn from, by release date.",
      "films with a release year on file",
      ["Before 1970", "1970s and 80s", "1990s and 2000s", "2010 onward"],
      signals.eraBands,
    );
  }

  if (covered(signals.runtimeKnownCount)) {
    axis(
      "runtime",
      "How long you sit",
      "How long the films you rate actually run.",
      "films with a runtime on file",
      ["Under 90 min", "90 to 120", "2 hours to 2½", "Over 2½ hours"],
      signals.runtimeBands,
    );
  }

  if (covered(signals.voteKnownCount)) {
    axis(
      "reach",
      "How far off the beaten path",
      "How widely seen your films are, by how many people have rated them anywhere.",
      "films with an audience count on file",
      ["Everyone has seen it", "Widely seen", "Some following", "Barely rated"],
      signals.reachBands,
    );
  }

  const viewings = signals.viewingBands[0] + signals.viewingBands[1];
  if (viewings >= COVERAGE_MIN_FILMS) {
    axis(
      "viewing",
      "First times and returns",
      "How much of your diary is going back to something you have already seen.",
      viewings === 1 ? "logged viewing" : "logged viewings",
      ["First time", "Rewatch"],
      signals.viewingBands,
    );
  }

  return out;
}

/**
 * Counts to whole percentages that add to exactly 100.
 *
 * Largest remainder rather than per-value rounding, which lands on 99 or 101
 * about as often as not. A profile that does not add up is the whole reason
 * this exists. Empty bands are dropped: a segment of zero draws nothing and
 * reads as a gap in the list.
 */
function shareOut(labels: string[], counts: number[], total: number): PersonalityBand[] {
  const exact = counts.map((c) => (c / total) * 100);
  const pcts = exact.map(Math.floor);
  const short = 100 - pcts.reduce((a, b) => a + b, 0);

  Array.from(exact.keys())
    .sort((a, b) => exact[b] - Math.floor(exact[b]) - (exact[a] - Math.floor(exact[a])))
    .slice(0, short)
    .forEach((i) => pcts[i]++);

  return labels
    .map((label, i) => ({ label, pct: pcts[i], count: counts[i] }))
    .filter((b) => b.count > 0);
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
  /** where this card sits on the ladder, and what actually moves it next */
  standing: TierStanding | null;
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
  personality: PersonalityAxis[];
  favsCard: Stat[];
  social: TasteMatch[];
  /** the "regular" home hero panel: films / hours / home decade / this year */
  heroStats: Stat[];
  genreShare: { name: string; pct: number }[];
  /** the themes the library runs on, for the DNA strip on the back */
  themeDNA: { name: string; pct: number; lift: number }[];
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

  if (taste.rated === 0) {
    return {
      ...taste,
      archetype: null,
      archetypeMeaning: "",
      full,
      toFull: FULL_CARD_THRESHOLD,
      // Nothing rated means nothing met, so this is Common without asking.
      tier: computeTier(0),
      standing: null,
      variant: { name: "", stock: "", accent: "", aura: "", accentColor: "#8faecc" },
      traits: [],
      traitsHeldCount: 0,
      traitsTotal: 0,
      traitsHidden: 0,
      signatureFilms: [],
      decadeBreakdown,
      ratings: [],
      profStats: [],
      personality: [],
      favsCard: [],
      social: [],
      heroStats: [],
      genreShare: [],
      themeDNA: [],
    };
  }

  const [signals, match] = await Promise.all([
    getTasteSignals(userId, { includePrivate }),
    getBestMatchAndRival(userId, friendIds),
  ]);

  // Computed here rather than above, because the milestones are half the
  // answer and they need the signals.
  // One call decides both the tier and what the card says about reaching the
  // next one, so the two can never disagree.
  /**
   * The ladder counts what was watched, not how many rows it took.
   *
   * A season is one row and five films of viewing, so counting rows made a
   * television watcher climb five times slower per hour spent. `SEASON_WEIGHT`
   * is the correction and the binder states it.
   */
  const ladderSize = Math.round(
    weightedSize(taste.rated - signals.seasonCount, signals.seasonCount),
  );
  const standing = tierStanding(ladderSize, signals);
  const tier = standing.tier;

  const variant = computeVariant(
    signals,
    taste.topGenres[0]?.name,
    signals.topRatedDecade,
    taste.topDecade?.decade ?? null,
    taste.mean,
  );

  // Read once, below the signals, because the title now depends on them. Both
  // halves and both explanations come from the same call, so the card and the
  // binder cannot describe the same title differently.
  const read = readArchetype(taste.topGenres[0]?.name, taste.topGenres, signals);
  const archetype = taste.rated >= CLASS_THRESHOLD ? read.title : null;

  // Picked after the signals, because every slot needs them: conviction is
  // measured against this person's own mean and spread, and the last slot
  // falls back to the theme the title is named after.
  const signatureFilms = await pickSignatureFilms(userId, signals, read.themeKey, {
    includePrivate,
  });

  const traits = evaluateTraits(signals);
  const heldTraits = traits.filter((t) => t.held);

  const rewatchPct = taste.rated ? Math.round((signals.rewatchEntryCount / taste.rated) * 100) : 0;

  return {
    ...taste,
    archetype,
    archetypeMeaning: taste.rated >= CLASS_THRESHOLD ? read.meaning : "",
    full,
    toFull: Math.max(0, FULL_CARD_THRESHOLD - taste.rated),
    tier,
    standing,
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
      { label: "Avg", value: taste.mean !== null ? formatTenths(taste.mean) : "-" },
      { label: "Rewatch", value: `${rewatchPct}%` },
      { label: "Reviews", value: String(signals.reviewCount) },
      { label: "Decades", value: String(signals.distinctDecades) },
    ],
    personality: computePersonality(taste, signals),
    favsCard: [
      { label: "Director", value: taste.topDirector?.name ?? "-" },
      { label: "Decade", value: taste.topDecade ? decadeLabel(taste.topDecade.decade) : "-" },
      { label: "Runtime", value: signals.avgRuntime ? runtimeBand(signals.avgRuntime) : "-" },
    ],
    // One entry when nobody is far enough away to be called a rival.
    social: match
      ? match.rival.name === match.bestMatch.name
        ? [match.bestMatch]
        : [match.bestMatch, match.rival]
      : [],
    heroStats: [
      { label: "Films logged", value: String(taste.rated) },
      { label: "Hours logged", value: String(Math.round(signals.totalRuntimeMinutes / 60)) },
      { label: "Home decade", value: taste.topDecade ? decadeLabel(taste.topDecade.decade) : "-" },
      { label: "Reviews", value: String(signals.reviewCount) },
    ],
    // share of *tagged* films, not all rated films — most libraries have gaps
    // in genre metadata, and dividing by the untagged total makes an honest
    // top genre read as a sliver
    genreShare: taste.topGenres.map((g) => ({
      name: g.name,
      pct: signals.genreTaggedCount ? Math.round((g.count / signals.genreTaggedCount) * 100) : 0,
    })),
    themeDNA: themeDNA(signals),
  };
}

export { ERA_BY_DECADE, ARCHETYPE_BY_GENRE };

/**
 * Recomputes the stored tier after something that could have moved it.
 *
 * Called from the write path rather than on render: a rating is the only thing
 * that changes a tier, and there are far fewer ratings than page views. The
 * nav then reads the answer off the session user it already has, so badging
 * the home tab costs nothing per request.
 *
 * `tierSeen` is left alone here. It is the reader's acknowledgement, and only
 * looking at the card should move it.
 */
export async function syncUserTier(userId: string): Promise<void> {
  const [taste, signals] = await Promise.all([
    getTasteProfile(userId, { includePrivate: true }),
    getTasteSignals(userId, { includePrivate: true }),
  ]);
  const tier =
    taste.rated > 0
      ? tierStanding(
          Math.round(weightedSize(taste.rated - signals.seasonCount, signals.seasonCount)),
          signals,
        ).tier.name
      : null;
  await db.update(users).set({ tier }).where(eq(users.id, userId));
}

/** Marks the current tier as seen, so the nav stops flagging it. */
export async function markTierSeen(userId: string, tier: string): Promise<void> {
  await db.update(users).set({ tierSeen: tier }).where(eq(users.id, userId));
}

/**
 * Whether the reader has a tier change waiting that they have not looked at.
 *
 * Only upward moves are flagged. A tier can fall when private entries are
 * hidden or an entry is deleted, and telling somebody their card went down is
 * not a notification, it is a poke.
 */
export function hasUnseenTier(user: { tier: string | null; tierSeen: string | null }): boolean {
  if (!user.tier || user.tier === user.tierSeen) return false;
  if (!user.tierSeen) return false;
  const now = RARITY_TIERS.findIndex((t) => t.name === user.tier);
  const seen = RARITY_TIERS.findIndex((t) => t.name === user.tierSeen);
  return now > seen;
}
