import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { CLUSTERS } from "./archetype-clusters";
import {
  buildPreferenceProfile,
  primaryThemeFor,
  representation,
  themesFor,
  type PreferenceProfile,
  type ProfileInput,
} from "./preference-profile";
import type { TasteSignals } from "./taste-card-signals";

/**
 * The four works that best prove what somebody's taste is.
 *
 * The question this answers changed. The old algorithm asked which four titles
 * best *reproduce the demographics of a shelf* — it built a target vector out of
 * era, popularity and language, then chose the four whose average landed nearest
 * it. Era, reach and language carried eight times the weight of every theme
 * combined, so the quartet was chosen mostly on when things were made and how
 * famous they were, and the result read like a census rather than a portrait.
 *
 * This asks which four best *prove a taste*. A title earns its place by being
 * loved, by expressing what this person's preference profile actually is, and by
 * saying something about them that a similar viewer's card would not say.
 */

export type SignatureUnit = "movie" | "show";

export type SignatureReason = {
  /** the component that put it here */
  kind: string;
  /** a sentence a person would say */
  text: string;
};

export type SignatureTitle = {
  slug: string;
  title: string;
  posterPath: string | null;
  rating: number;
  unit: SignatureUnit;
  /** 0-1 signature strength, for ordering and for hysteresis */
  score: number;
  /** 0-1, how much evidence stands behind the score */
  confidence: number;
  /** the short name of what this title is doing on the card */
  label: string;
  /** the one line that says why this title and not another */
  reason: string;
  supportingReasons: string[];
  /** the raw facts the sentences were written from */
  evidence: {
    ratingZ: number;
    representation: number;
    distinctiveness: number;
    stability: number;
    attachment: number;
    outlier: number;
    viewings: number;
    reviews: number;
    ratedSeasons?: number;
    totalSeasons?: number;
  };
};

/**
 * The weights, stated rather than tuned into a corner.
 *
 * Affection leads because a signature that somebody does not love is not a
 * signature at all. Representation is second because the card is a portrait, not
 * a favourites list. Everything below fifteen percent is a tiebreak between
 * titles that already deserve to be there.
 */
const WEIGHTS = {
  affection: 0.35,
  representation: 0.22,
  distinctiveness: 0.13,
  stability: 0.1,
  attachment: 0.1,
  /**
   * Worth more than the follow-on reading it replaces.
   *
   * Five percent was the right price for a signal that mostly restated a shared
   * credit. An exception to somebody's taste is the rarest thing a shelf
   * contains and the one a reader could never work out for themselves, so it is
   * paid for out of representation and distinctiveness — the two components it
   * sits between, and the two that would otherwise crowd it out.
   */
  outlier: 0.1,
} as const;

type Candidate = {
  slug: string;
  title: string;
  unit: SignatureUnit;
  posterPath: string | null;
  rating: number;
  director: string | null;
  keywords: string[] | null;
  themes: Set<string>;
  primaryTheme: string | null;
  year: number | null;
  language: string | null;
  reach: number | null;
  embedding: number[] | null;
  viewings: number;
  reviews: number;
  /** days since this was first logged, so an old verdict can count as a settled one */
  ageDays: number;
  /** how far the rating moved across rewatches; null when it was only ever rated once */
  ratingSpread: number | null;
  /** manual position among rating ties, when the user has dragged one */
  ranked: boolean;
  /** shows only */
  ratedSeasons?: number;
  totalSeasons?: number;
  seasonSpread?: number;
  finished?: boolean;
  /** how many people here have rated it, and what they gave it */
  crowdCount: number;
  crowdMean: number | null;
};

/**
 * Every unit that may appear on the Master Card.
 *
 * A season is never one. Seasons are how somebody records an opinion about
 * television, but "season three of a show you have not heard of" proves nothing
 * about a person to anybody reading their card; the series does. So seasons are
 * collapsed into the show they belong to and become its evidence.
 *
 * A show qualifies on a whole-series rating when there is one, and otherwise on
 * the seasons that were rated. That fallback is load-bearing rather than
 * defensive: no account in the database has ever rated a series whole, so a
 * strict reading of "whole show" would delete television from every card in the
 * product.
 */
async function loadCandidates(userId: string, privacy: SQL): Promise<Candidate[]> {
  const rows = await db.execute(sql`
    with cur as (
      select distinct on (d.film_id) d.film_id, d.rating, d.watched_on, d.created_at
      from diary_entries d
      where d.user_id = ${userId} and d.rating is not null and ${privacy}
      order by d.film_id, d.watched_on desc nulls last, d.created_at desc
    ),
    spans as (
      select film_id,
             count(*)::int as n,
             count(*) filter (where review is not null and length(trim(review)) > 0)::int as reviews,
             -- How long this opinion has stood: days since it was FIRST logged.
             --
             -- This used to be the span between the first and last entry, which
             -- is not how long a rating has been held at all — a title watched
             -- once scored zero however many years ago it was, and the number
             -- only became non-zero on a rewatch. It was the rewatch signal
             -- wearing a different name, and it double-counted with attachment.
             extract(epoch from (now() - min(coalesce(watched_on::timestamptz, created_at))))
               / 86400 as age_days,
             -- Whether the verdict moved when they went back to it. Null when
             -- there is only one rating, because one rating is not a trend.
             case when count(rating) > 1 then max(rating) - min(rating) end as rating_spread
      from diary_entries
      where user_id = ${userId} and ${privacy}
      group by film_id
    ),
    -- What everyone else here thinks, for distinctiveness. Private entries are
    -- excluded from the crowd whatever the viewer is allowed to see of their own.
    crowd as (
      select film_id, count(*)::int as n, avg(rating)::float as mean
      from (
        select distinct on (d.user_id, d.film_id) d.user_id, d.film_id, d.rating
        from diary_entries d
        where d.rating is not null and d.private = false
        order by d.user_id, d.film_id, d.watched_on desc nulls last, d.created_at desc
      ) z group by film_id
    )
    select f.id, f.slug, f.title, f.kind, f.show_id, f.season_number, f.poster_path,
           f.director, f.keywords, f.year, f.original_language, f.embedding,
           coalesce(f.imdb_votes, f.vote_count * 50) as reach,
           c.rating,
           coalesce(s.n, 1) as viewings,
           coalesce(s.reviews, 0) as reviews,
           coalesce(s.age_days, 0) as age_days,
           s.rating_spread,
           (lo.film_id is not null) as ranked,
           coalesce(cr.n, 0) as crowd_n, cr.mean as crowd_mean,
           sh.slug as show_slug, sh.name as show_name, sh.poster_path as show_poster,
           sh.creators, sh.keywords as show_keywords, sh.first_air_year, sh.original_language as show_lang,
           -- Specials (season zero) are not seasons. Counting them would make a
           -- series look unfinished for want of a Christmas one-off.
           (select count(*)::int from films t
            where t.kind = 'season' and t.show_id = f.show_id
              and coalesce(t.season_number, 1) > 0) as total_seasons,
           sh.status as show_status
    from cur c
    join films f on f.id = c.film_id
    left join spans s on s.film_id = c.film_id
    left join crowd cr on cr.film_id = c.film_id
    left join library_order lo on lo.film_id = c.film_id and lo.user_id = ${userId}
    left join shows sh on sh.id = f.show_id
    -- Deterministic. Identity must not depend on the order Postgres happens to
    -- return rows in; the old query had no ordering at all and its theme space
    -- was built from whichever twenty-four themes arrived first.
    order by f.slug
  `);

  const raw = rows as unknown as Record<string, unknown>[];
  const movies: Candidate[] = [];
  /** show_id → the rows that speak for it */
  const byShow = new Map<string, Record<string, unknown>[]>();

  for (const r of raw) {
    const kind = r.kind as string;
    if (kind === "movie") {
      movies.push(toCandidate(r, "movie"));
      continue;
    }
    const showId = r.show_id as string | null;
    if (!showId) continue;
    const list = byShow.get(showId) ?? [];
    list.push(r);
    byShow.set(showId, list);
  }

  const shows: Candidate[] = [];
  for (const [, rowsForShow] of byShow) {
    const whole = rowsForShow.find((r) => (r.kind as string) === "show");
    const seasons = rowsForShow.filter(
      (r) => (r.kind as string) === "season" && Number(r.season_number ?? 1) > 0,
    );
    const head = whole ?? seasons[0];
    if (!head) continue;

    const seasonRatings = seasons.map((r) => r.rating as number);
    // A whole-series rating is the person's own summary and outranks the
    // arithmetic; without one, the seasons average into a verdict.
    const rating =
      whole !== undefined
        ? (whole.rating as number)
        : Math.round(seasonRatings.reduce((a, b) => a + b, 0) / Math.max(1, seasonRatings.length));

    const spread =
      seasonRatings.length > 1
        ? Math.max(...seasonRatings) - Math.min(...seasonRatings)
        : 0;

    const c = toCandidate(head, "show");
    c.slug = (head.show_slug as string) ?? c.slug;
    c.title = (head.show_name as string) ?? c.title;
    c.posterPath = (head.show_poster as string) ?? c.posterPath;
    c.rating = rating;
    c.director = firstOf(head.creators) ?? c.director;
    c.year = (head.first_air_year as number) ?? c.year;
    c.language = (head.show_lang as string) ?? c.language;
    // Series keywords when the show carries them; otherwise the season's, which
    // are copied down from the series anyway.
    const showKeywords = Array.isArray(head.show_keywords) ? (head.show_keywords as string[]) : null;
    if (showKeywords && showKeywords.length > 0) {
      c.keywords = showKeywords;
      c.themes = themesFor(showKeywords);
      c.primaryTheme = primaryThemeFor(showKeywords);
    }
    c.viewings = seasons.reduce((n, r) => n + (r.viewings as number), 0) || c.viewings;
    c.reviews = rowsForShow.reduce((n, r) => n + (r.reviews as number), 0);
    c.ageDays = Math.max(...rowsForShow.map((r) => Number(r.age_days ?? 0)));
    c.ranked = rowsForShow.some((r) => r.ranked === true);
    c.ratedSeasons = seasons.length;
    c.totalSeasons = (head.total_seasons as number) ?? seasons.length;
    c.seasonSpread = spread;
    // Finished, not merely caught up: a returning series gains seasons, and a
  // card that says "you finished this" must not be made false by an airdate.
  const ended = ["Ended", "Canceled"].includes(String(head.show_status ?? ""));
  c.finished = ended && (c.totalSeasons ?? 0) > 0 && seasons.length >= (c.totalSeasons ?? 0);
    c.crowdCount = rowsForShow.reduce((n, r) => n + (r.crowd_n as number), 0);
    const means = rowsForShow.map((r) => r.crowd_mean).filter((m): m is number => m !== null);
    c.crowdMean = means.length ? means.reduce((a, b) => a + b, 0) / means.length : null;
    shows.push(c);
  }

  return [...movies, ...shows];
}

function firstOf(v: unknown): string | null {
  return Array.isArray(v) && v.length > 0 ? String(v[0]) : null;
}

function toCandidate(r: Record<string, unknown>, unit: SignatureUnit): Candidate {
  const keywords = Array.isArray(r.keywords) ? (r.keywords as string[]) : null;
  return {
    slug: r.slug as string,
    title: r.title as string,
    unit,
    // Poster availability is a rendering fact, not an identity fact. The old
    // query excluded posterless titles outright, so a missing image could
    // silently disqualify somebody's favourite film from being who they are.
    posterPath: (r.poster_path as string) ?? null,
    rating: r.rating as number,
    director: (r.director as string) ?? null,
    keywords,
    themes: themesFor(keywords),
    primaryTheme: primaryThemeFor(keywords),
    year: (r.year as number) ?? null,
    language: (r.original_language as string) ?? null,
    reach: r.reach === null || r.reach === undefined ? null : Number(r.reach),
    embedding: Array.isArray(r.embedding) ? (r.embedding as number[]) : null,
    viewings: Number(r.viewings ?? 1),
    reviews: Number(r.reviews ?? 0),
    ageDays: Number(r.age_days ?? 0),
    ratingSpread: r.rating_spread === null || r.rating_spread === undefined ? null : Number(r.rating_spread),
    ranked: r.ranked === true,
    crowdCount: Number(r.crowd_n ?? 0),
    crowdMean: r.crowd_mean === null || r.crowd_mean === undefined ? null : Number(r.crowd_mean),
  };
}

// ---------------------------------------------------------------------------
// The six components. Each returns 0-1 and knows nothing about the others.

/**
 * How much this person loves this title, on their own scale.
 *
 * Per title, never per library. The old version decided once for the whole
 * shelf whether rewatches counted, so a single rewatch anywhere switched the
 * rewatch term on for every other title and quietly re-scored the lot. Here a
 * title is judged on the evidence it personally carries: conviction always,
 * plus returning and writing when this title has them.
 */
function affection(c: Candidate, mean: number, sd: number): number {
  const z = (c.rating - mean) / sd;
  const conviction = Math.max(0, Math.min(1, z / 2));

  let score = conviction;
  let weight = 1;
  if (c.viewings >= 2) {
    score += 0.5 * Math.min(1, (c.viewings - 1) / 2);
    weight += 0.5;
  }
  if (c.reviews > 0) {
    score += 0.25;
    weight += 0.25;
  }
  return Math.max(0, Math.min(1, score / weight));
}

/**
 * Whether loving this says anything particular about this person.
 *
 * Two halves, and the second gates the first. Rarity alone rewards anybody who
 * rates obscure things highly, which is a contrarian detector rather than a
 * taste one. So an unusual opinion only counts when the rest of the library
 * supports it: the title has to sit in a theme this person is genuinely
 * unusual for.
 */
/**
 * Whether the crowd here is big and real enough to be compared against.
 *
 * Today it is neither: eighty-two of the eighty-three accounts are generated
 * fixtures, so "you rate this higher than other people here" would mean "you
 * disagree with a seeder". The measurement still runs — it is worth having the
 * machinery warm — but while this is false the population half is left out of
 * the score and never spoken aloud, and distinctiveness rests on the catalogue
 * instead. Flip it when there are genuine profiles to compare against.
 */
const POPULATION_IS_REAL = false;

function distinctiveness(c: Candidate, profile: PreferenceProfile): number {
  const patternSupport = Math.max(
    0,
    ...[...c.themes].map((k) => Math.min(1, ((profile.lift[k] ?? 1) - 1) / 2)),
  );

  // Against the crowd here, when enough of the crowd has an opinion.
  let againstCrowd = 0;
  if (POPULATION_IS_REAL && c.crowdCount >= 5 && c.crowdMean !== null) {
    againstCrowd = Math.max(0, Math.min(1, (c.rating - c.crowdMean) / 20));
  }

  // Few people having rated it at all is weak evidence on its own.
  const rarity = c.reach === null ? 0 : Math.max(0, Math.min(1, 1 - c.reach / 200_000));

  // With no real crowd, rarity carries the whole reading rather than 40% of it,
  // which keeps the component meaningful without inventing a comparison.
  return POPULATION_IS_REAL
    ? Math.max(0, Math.min(1, patternSupport * (0.6 * againstCrowd + 0.4 * rarity)))
    : Math.max(0, Math.min(1, patternSupport * rarity));
}

/**
 * Whether the opinion has held.
 *
 * A rating given once last week is a first impression. One that has survived a
 * year, or a rewatch, or a whole series without falling apart, is a position.
 */
function stability(c: Candidate): number {
  const parts: number[] = [];

  // A verdict that has stood for years is a position rather than a first
  // impression, and this is true whether or not they ever went back to it.
  parts.push(Math.max(0, Math.min(1, c.ageDays / 730)));

  // Going back and landing on the same number is the strongest evidence an
  // opinion held. Absent rather than zero when they only rated it once: no
  // second reading is not the same as a reading that moved.
  if (c.ratingSpread !== null) {
    parts.push(Math.max(0, Math.min(1, 1 - c.ratingSpread / 20)));
  }

  // For a series, agreeing with yourself across seasons is the same evidence.
  if (c.seasonSpread !== undefined) {
    parts.push(Math.max(0, Math.min(1, 1 - c.seasonSpread / 30)));
  }

  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/** What somebody has actually done about a title beyond rating it. */
function attachment(c: Candidate): number {
  let score = 0;
  if (c.viewings >= 2) score += 0.35;
  if (c.viewings >= 3) score += 0.15;
  if (c.reviews > 0) score += 0.2;
  if (c.ranked) score += 0.15;
  if (c.finished) score += 0.15;
  return Math.max(0, Math.min(1, score));
}

/**
 * The one that does not fit, and is loved anyway.
 *
 * This replaces a follow-on reading that measured whether more of the same
 * director or theme got rated afterwards. That was association wearing the
 * clothes of insight: it could not tell a taste being formed from two films
 * sharing a credit, and it produced lines like "you went on to rate more Jared
 * Bush films" about a co-director nobody was following.
 *
 * This asks something a person cannot already know: everything else you love
 * looks like *this*, and then there is this one, which looks like none of it,
 * and you rate it at the top anyway. It is the exact mirror of representation,
 * so a quartet naturally gets both its clearest example and its exception —
 * and an exception is the most interesting thing a shelf can contain, because
 * nothing about a taste explains it.
 *
 * Gated on the profile being worth contradicting. Against a thin or unformed
 * profile everything looks like an outlier, which would make the slot fire
 * loudest exactly when it knows least.
 */
function outlier(c: Candidate, profile: PreferenceProfile): number {
  // Nothing is an exception to a taste we cannot describe.
  if (profile.confidence < 0.5 || profile.top.length < 3) return 0;
  // A title with no themes is unreadable, not unusual.
  if (c.themes.size === 0) return 0;

  const fit = representation(profile, c.keywords);
  // Below a third is where a title stops being a variation on their taste and
  // starts being a departure from it.
  if (fit > 0.33) return 0;
  return Math.max(0, Math.min(1, (0.33 - fit) / 0.33));
}

/** How much of the metadata this score actually rested on. */
function confidenceFor(c: Candidate, profile: PreferenceProfile): number {
  let known = 0;
  let total = 0;
  const has = (ok: boolean, weight = 1) => {
    total += weight;
    if (ok) known += weight;
  };
  has(c.themes.size > 0, 2);
  has(c.reach !== null);
  has(c.embedding !== null);
  has(c.year !== null);
  has(c.crowdCount >= 5);
  // A title cannot be more certain than the profile it was measured against.
  return Math.max(0, Math.min(1, (known / total) * (0.5 + 0.5 * profile.confidence)));
}

// ---------------------------------------------------------------------------

export type ScoredCandidate = Candidate & {
  score: number;
  confidence: number;
  parts: {
    affection: number;
    representation: number;
    distinctiveness: number;
    stability: number;
    attachment: number;
    outlier: number;
  };
};

function scoreAll(
  candidates: Candidate[],
  profile: PreferenceProfile,
  mean: number,
  sd: number,
): ScoredCandidate[] {
  return candidates.map((c) => {
    const parts = {
      affection: affection(c, mean, sd),
      representation: representation(profile, c.keywords),
      distinctiveness: distinctiveness(c, profile),
      stability: stability(c),
      attachment: attachment(c),
      outlier: outlier(c, profile),
    };
    const score =
      parts.affection * WEIGHTS.affection +
      parts.representation * WEIGHTS.representation +
      parts.distinctiveness * WEIGHTS.distinctiveness +
      parts.stability * WEIGHTS.stability +
      parts.attachment * WEIGHTS.attachment +
      parts.outlier * WEIGHTS.outlier;
    return { ...c, score, confidence: confidenceFor(c, profile), parts };
  });
}

/**
 * The bar a title clears before it may represent somebody at all.
 *
 * Coverage cannot buy a slot. The old objective let a merely tolerated film in
 * because it conveniently filled an era, which is how a card ended up proving a
 * taste with something its owner shrugged at.
 */
function eligible(c: ScoredCandidate, mean: number, sd: number, decile: number): boolean {
  const z = (c.rating - mean) / sd;
  if (c.rating >= decile) return true;
  if (z >= 1) return true;
  // Returning to something repeatedly is its own argument, provided the rating
  // agrees.
  if (c.viewings >= 3 && z >= 0.5) return true;
  // A series carried all the way through, rated well, has earned it.
  if (c.finished && z >= 0.5) return true;
  return false;
}

const NEAR_DUPLICATE = 0.75;

function cosine(a: number[] | null, b: number[] | null): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Redundancy, discouraged rather than banned.
 *
 * Somebody whose four defining works are all paranoid thrillers is allowed four
 * paranoid thrillers; refusing the second makes the card more varied and less
 * true. Every penalty here is soft.
 */
function redundancy(c: ScoredCandidate, chosen: ScoredCandidate[]): number {
  let penalty = 0;
  for (const p of chosen) {
    if (c.director && p.director === c.director) penalty += 0.12;
    if (c.primaryTheme && p.primaryTheme === c.primaryTheme) penalty += 0.1;
    const near = cosine(c.embedding, p.embedding);
    // Franchise protection. Titles the nightly job has not embedded skip this
    // check, which is why the miss is recorded in confidence rather than hidden.
    if (near >= NEAR_DUPLICATE) penalty += 0.3 * near;
  }
  return penalty;
}

/** How much of the profile's strongest dimensions a set covers between them. */
function coverage(set: ScoredCandidate[], profile: PreferenceProfile): number {
  if (profile.top.length === 0) return 0;
  const held = new Set(set.flatMap((c) => [...c.themes]));
  let covered = 0;
  let total = 0;
  for (const dim of profile.top.slice(0, 5)) {
    total += dim.share;
    if (held.has(dim.key)) covered += dim.share;
  }
  return total > 0 ? covered / total : 0;
}

const COVERAGE_WEIGHT = 0.35;
const FORMAT_BONUS = 0.04;

/**
 * The quartet, chosen as a set.
 *
 * Not the top four scores: four titles that each prove the same one thing prove
 * it four times and prove nothing else. The set is grown greedily on its own
 * value — the strength it contains, plus how much of the profile it covers
 * between its members, minus how much its members repeat each other.
 *
 * There is no reserved first slot. The old anchor handed slot one to the
 * highest-rated title and broke ties on fame, which put the same canonical
 * films on every card that had them. Which member becomes the hero tile is a
 * layout decision, made after the set exists.
 */
function chooseQuartet(
  pool: ScoredCandidate[],
  profile: PreferenceProfile,
): ScoredCandidate[] {
  const chosen: ScoredCandidate[] = [];
  const taken = new Set<string>();

  while (chosen.length < 4) {
    let best: ScoredCandidate | undefined;
    let bestValue = -Infinity;

    for (const c of pool) {
      if (taken.has(c.slug)) continue;
      const trial = [...chosen, c];
      const value =
        trial.reduce((sum, t) => sum + t.score, 0) +
        COVERAGE_WEIGHT * coverage(trial, profile) -
        redundancy(c, chosen) +
        // A small nudge only. Never a quota: a film-only shelf keeps four films.
        (chosen.length > 0 && chosen.every((p) => p.unit === c.unit) ? 0 : FORMAT_BONUS);
      if (value > bestValue) {
        bestValue = value;
        best = c;
      }
    }
    if (!best) break;
    taken.add(best.slug);
    chosen.push(best);
  }

  return chosen.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------

/**
 * Which component put this title here, said the way a person would say it.
 *
 * `used` carries the angles the other three have already taken. Repetition in
 * the *selection* is allowed on purpose — four paranoid thrillers can genuinely
 * be the answer — but repetition in the *sentences* is never right: two titles
 * printing "the clearest intersection of your taste for revenge, vigilantes and
 * hired killers" word for word reads as a broken template even when both picks
 * are correct. So a title whose best angle is spoken for falls through to its
 * next strongest, which is always a true statement about it either way.
 */
function explain(
  c: ScoredCandidate,
  profile: PreferenceProfile,
  lead: string,
  profileMean: number,
): { label: string; reason: string; supporting: string[]; angle: string } {
  /**
   * The one theme this title shares most strongly with the profile.
   *
   * One, not two. Joining the two strongest with "and" produced sentences that
   * were long and sometimes plainly wrong about the film — Wreck-It Ralph came
   * out as "growing up, school and first love and prison, escape and captivity",
   * because the second theme was the profile's, not the title's. A caption that
   * describes the wrong film is worse than a shorter one.
   */
  const themeNames = [...c.themes]
    .map((k) => profile.top.find((t) => t.key === k))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .sort((a, b) => b.share * b.lift - a.share * a.lift);

  /**
   * The extra facts, minus whatever the headline already said.
   *
   * When attachment is the reason a title is here, the sentence above already
   * reads "you have watched this three times" — repeating it underneath as a
   * supporting note is the same fact printed twice, which is exactly what makes
   * a panel look generated rather than written.
   */
  const supporting: string[] = [];
  if (lead !== "attachment") {
    if (c.viewings >= 3) supporting.push(`You have been back to it ${c.viewings} times.`);
    else if (c.viewings === 2) supporting.push("You have watched it twice.");
    if (c.finished && c.totalSeasons)
      supporting.push(`You watched all ${c.totalSeasons} seasons.`);
  }
  if (c.reviews > 0) supporting.push("You stopped to write something down after it.");

  /**
   * The theme, as a noun phrase that can follow "your taste for".
   *
   * A cluster's `note` is written to slot into "your films are about ___", so it
   * reads as a list of subjects: "revenge, vigilantes and hired killers". Every
   * sentence below has to supply its own preposition around that, and one of
   * them did not — "a defining example of your revenge, vigilantes and hired
   * killers" was missing the two words that make it a sentence.
   */
  const theme = themeNames[0]?.note ?? null;
  const angle = lead;

  const rating = (c.rating / 10).toFixed(1);
  const avg = (profileMean / 10).toFixed(1);
  const above = ((c.rating - profileMean) / 10).toFixed(1);
  const share = themeNames[0] ? Math.round(themeNames[0].share * 100) : 0;

  switch (lead) {
    case "representation":
      return {
        label: "Most like the rest of your shelf",
        reason: theme
          ? `${share}% of what you rate is about ${theme}. This is the strongest example of it you own.`
          : `It sits closest to the middle of what you actually watch.`,
        supporting,
        angle,
      };
    case "distinctiveness":
      return {
        label: POPULATION_IS_REAL ? "Least like everyone else" : "The deep cut",
        reason:
          POPULATION_IS_REAL && c.crowdCount >= 5 && c.crowdMean !== null
            ? `You gave this ${rating}. The ${c.crowdCount} other people here who rated it average ${(c.crowdMean / 10).toFixed(1)}.`
            : theme
              ? `Hardly anyone has seen this, and you rate it ${rating}. It is the least predictable thing about your taste for ${theme}.`
              : `Hardly anyone has seen this, and you rate it ${rating}.`,
        supporting,
        angle,
      };
    case "attachment":
      return {
        label: c.unit === "show" ? "You stayed with it" : "You keep going back",
        reason:
          c.unit === "show" && c.totalSeasons
            ? `You rated all ${c.totalSeasons} seasons. Almost nothing else here gets finished.`
            : `You have watched this ${c.viewings} times. Nearly everything else you rate, you rate once.`,
        supporting,
        angle,
      };
    case "stability":
      return {
        label: "You have not changed your mind",
        reason:
          c.ratingSpread !== null && c.ratingSpread <= 5
            ? `You have rated this more than once and landed on the same number both times.`
            : c.ageDays > 365
              ? `You logged this ${Math.round(c.ageDays / 365)} years ago at ${rating} and it has stood since.`
              : `Your verdict on this has not moved.`,
        supporting,
        angle,
      };
    case "outlier":
      return {
        label: "The one that breaks the pattern",
        reason: theme
          ? `Almost nothing else you rate this highly is about ${theme}. You love it anyway, and that is the part of your taste nothing else on this card would tell anyone.`
          : `It looks nothing like the rest of what you love, and you rate it at the top regardless.`,
        supporting,
        angle,
      };
    default:
      /**
       * Affection, said as a number the reader can check.
       *
       * This label used to read "One of your highest", which contradicted the
       * heading directly above it, and then "The one you are surest about",
       * which is a feeling rather than a fact. The rating and the average are
       * both on the card already; saying the gap between them is the plainest
       * true thing there is.
       */
      return {
        label: "Your highest conviction",
        reason: `You gave this ${rating}. Your average is ${avg}, so it sits ${above} above everything else you log.`,
        supporting,
        angle,
      };
  }
}

/**
 * Which angle each member of the quartet gets to speak from.
 *
 * Picking each title's highest-scoring component independently does not work,
 * and the failure is visible rather than theoretical: affection carries the
 * largest weight and every member of a quartet is, by construction, something
 * the person loves — so affection led on three of four and the panel printed
 * "One of your highest" three times under a heading that opens "not the four
 * highest ratings".
 *
 * What matters is not how high a component scores but how much a title stands
 * out on it *compared to the other three*. A title that is merely as loved as
 * its neighbours is not interesting for being loved; the one that is far more
 * rewatched than the rest is interesting for that. So each component is centred
 * on the set, and the four take turns claiming the angle they are most above
 * average on, strongest claim first.
 */
function assignAngles(
  quartet: ScoredCandidate[],
): { c: ScoredCandidate; lead: string }[] {
  const kinds = ["affection", "representation", "distinctiveness", "stability", "attachment", "outlier"] as const;
  const mean: Record<string, number> = {};
  for (const k of kinds) {
    mean[k] = quartet.reduce((sum, c) => sum + c.parts[k], 0) / Math.max(1, quartet.length);
  }

  const claims = quartet.flatMap((c, i) =>
    kinds.map((k) => ({ i, kind: k as string, edge: c.parts[k] - mean[k] })),
  );
  claims.sort((a, b) => b.edge - a.edge);

  const leadFor = new Array<string | null>(quartet.length).fill(null);
  const usedKind = new Set<string>();
  for (const claim of claims) {
    if (leadFor[claim.i] !== null || usedKind.has(claim.kind)) continue;
    leadFor[claim.i] = claim.kind;
    usedKind.add(claim.kind);
  }
  // Six components and four slots, so this only fires if two titles are
  // identical across every axis.
  return quartet.map((c, i) => ({ c, lead: leadFor[i] ?? "affection" }));
}

export type SignatureResult = {
  titles: SignatureTitle[];
  /** "ok" once there is enough to choose from; "provisional" below that */
  status: "ok" | "provisional";
  /** 0-1 for the set as a whole */
  confidence: number;
  profile: PreferenceProfile;
};

/** Below this there is nothing to choose between and saying so is the honest answer. */
const ENOUGH_TO_CHOOSE = 10;

export async function pickSignatureTitles(
  userId: string,
  signals: TasteSignals,
  { includePrivate = false }: { includePrivate?: boolean } = {},
): Promise<SignatureResult> {
  const privacy: SQL = includePrivate ? sql`true` : sql`private = false`;
  const candidates = await loadCandidates(userId, privacy);
  return selectFromCandidates(
    candidates,
    signals.mean ?? 70,
    signals.ratingStdDev && signals.ratingStdDev > 3 ? signals.ratingStdDev : 10,
  );
}

/** A candidate as the selector needs it, for callers that build their own. */
export type SignatureCandidate = Candidate;

/**
 * Everything after the database: profile, scoring, eligibility, quartet.
 *
 * Split out so the selection can be exercised without Postgres. A library that
 * is "a harsh rater with four hundred films" or "anime only" is ten lines of
 * fixture here and a seeding script otherwise, and the part worth testing is
 * this half — the query is deterministic and the rest is arithmetic.
 */
export function selectFromCandidates(
  candidates: Candidate[],
  mean: number,
  sd: number,
): SignatureResult {
  // The profile is built from the whole library weighted by love, and the same
  // profile is what candidates are then measured against. The old version built
  // its target from everything and then only allowed the top decile to compete,
  // so it asked a shelf of favourites to reproduce the shape of a shelf that
  // included everything somebody merely tolerated.
  const inputs: ProfileInput[] = candidates.map((c) => ({
    keywords: c.keywords,
    year: c.year,
    language: c.language,
    reach: c.reach,
    affection: affection(c, mean, sd),
  }));
  const profile = buildPreferenceProfile(inputs);

  if (candidates.length === 0) {
    return { titles: [], status: "provisional", confidence: 0, profile };
  }

  const scored = scoreAll(candidates, profile, mean, sd);

  if (candidates.length < ENOUGH_TO_CHOOSE) {
    // Not a portrait, and it does not pretend to be one. Each line still says
    // something true about the specific title rather than four identical
    // sentences apologising for the sample size.
    const titles = [...scored]
      .sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title))
      .slice(0, 4)
      .map((c) => toTitle(c, {
        label: "One of your best so far",
        reason: `Rated ${(c.rating / 10).toFixed(1)}. With a few more rated, these start being chosen on what they say about you.`,
        supporting: [],
      }));
    return {
      titles,
      status: "provisional",
      confidence: Math.min(0.35, candidates.length / ENOUGH_TO_CHOOSE),
      profile,
    };
  }

  const ratings = scored.map((c) => c.rating).sort((a, b) => a - b);
  const decile = ratings[Math.floor(ratings.length * 0.9)] ?? ratings[ratings.length - 1];

  let pool = scored.filter((c) => eligible(c, mean, sd, decile));
  // Never fewer than four to choose from; relax to the best available rather
  // than return a short card.
  if (pool.length < 4) {
    pool = [...scored].sort((a, b) => b.score - a.score).slice(0, Math.max(4, pool.length));
  }

  const quartet = chooseQuartet(pool, profile);
  const titles = assignAngles(quartet).map(({ c, lead }) =>
    toTitle(c, explain(c, profile, lead, mean)),
  );

  return {
    titles,
    status: "ok",
    confidence:
      titles.length > 0
        ? titles.reduce((sum, t) => sum + t.confidence, 0) / titles.length
        : 0,
    profile,
  };
}

function toTitle(
  c: ScoredCandidate,
  said: { label: string; reason: string; supporting: string[] },
): SignatureTitle {
  return {
    slug: c.slug,
    title: c.title,
    posterPath: c.posterPath,
    rating: c.rating,
    unit: c.unit,
    score: c.score,
    confidence: c.confidence,
    label: said.label,
    reason: said.reason,
    supportingReasons: said.supporting,
    evidence: {
      ratingZ: c.parts.affection,
      representation: c.parts.representation,
      distinctiveness: c.parts.distinctiveness,
      stability: c.parts.stability,
      attachment: c.parts.attachment,
      outlier: c.parts.outlier,
      viewings: c.viewings,
      reviews: c.reviews,
      ratedSeasons: c.ratedSeasons,
      totalSeasons: c.totalSeasons,
    },
  };
}

/** The theme names a profile is built on, for anything that wants to name them. */
export function profileThemeNames(profile: PreferenceProfile): string[] {
  return profile.top.map((t) => t.name).filter((n) => CLUSTERS.some((c) => c.name === n));
}
