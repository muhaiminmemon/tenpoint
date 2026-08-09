import type { TasteSignals } from "./taste-card-signals";
import {
  CLUSTERS,
  CLUSTER_PREVALENCE,
  FORMAT_CLUSTERS,
  FORMAT_LEAD_SHARE,
  STOCK_BY_CLUSTER,
  clusterLabel,
} from "./archetype-clusters";

// ---------------------------------------------------------------------------
// LAYER 1 — LEVEL: films watched, mostly. Ticks up forever, no ceiling. Lives
// in taste.ts (buildHomeTasteCard) since it's a trivial function of `rated`.

// ---------------------------------------------------------------------------
// LAYER 2 — RARITY: a six-tier ladder on one number, Library Depth.
//
// Rank answers "how deep is this library", and nothing else. It is not a
// reading of taste, and nothing computed here may reach the archetype, the
// traits or the signature quartet.
//
// It used to state two counts per rung — "300 films or 75 seasons" — while
// computing `films/floor + seasons/seasonFloor`, a sum of fractions. Those are
// different rules, and the gap was wide enough to see in the data: the lowest
// film count actually holding Epic was 155, not 300, because 155 films and 45
// seasons is 1.12 rungs. A reader could not derive their own rank from what the
// card told them. One integer with fixed per-unit values can be checked against
// a diary by hand, which is the whole point.

export type RarityTier = {
  name: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic";
  index: number;
  /** library depth that reaches this rung */
  depth: number;
  range: string;
  effect: string;
  border: string;
  /**
   * The same rim, drawn without a conic gradient.
   *
   * The shared image is rendered by Satori, which cannot parse `conic-gradient`
   * at all: it throws while parsing the declaration, both attempts to draw fail,
   * and the endpoint answers 500. That silently broke the share card for every
   * account on the top two tiers, which are the accounts most likely to want
   * one. Present only where the screen rim is conic.
   */
  borderFlat?: string;
  /**
   * A class applied to the rim in the DOM, for a finish CSS can express and a
   * gradient string cannot. Only the top rung has one, and everything that
   * cannot run CSS -- the share image, above all -- falls back to `border`.
   */
  rimClass?: string;
  glow: string;
  labelColor: string;
  swatch: string;
  sheenOp: number;
  /** seconds for one aurora cycle; 0 on tiers whose foil does not move */
  sweepSec: number;
};

export const RARITY_TIERS: RarityTier[] = [
  {
    name: "Common",
    index: 0,
    depth: 0,
    range: "Your first rating",
    effect: "Matte. Just the essentials.",
    border: "#2a2a31",
    glow: "none",
    labelColor: "#8a8a92",
    swatch: "#1c1c21",
    sheenOp: 0,
    sweepSec: 0,
  },
  {
    name: "Uncommon",
    index: 1,
    depth: 60,
    range: "60 points",
    effect: "Brushed steel. A cleaner edge, faint sheen.",
    border: "linear-gradient(160deg,#33333b,#4a4a55)",
    glow: "none",
    labelColor: "#a6a6b0",
    swatch: "linear-gradient(120deg,#232329,#4a4a55)",
    sheenOp: 0.12,
    sweepSec: 0,
  },
  {
    name: "Rare",
    index: 2,
    depth: 200,
    range: "200 points",
    effect: "Polished steel, a brighter edge.",
    border: "linear-gradient(160deg,#4e535c,#9aa3b0)",
    glow: "none",
    labelColor: "#9aa3b0",
    swatch: "linear-gradient(120deg,#20242a,#9aa3b0)",
    sheenOp: 0.2,
    sweepSec: 0,
  },
  {
    name: "Epic",
    index: 3,
    depth: 500,
    range: "500 points",
    effect: "Silver foil, quiet shimmer.",
    border: "linear-gradient(160deg,#70757f,#d9dde3)",
    glow: "none",
    labelColor: "#d9dde3",
    swatch: "linear-gradient(120deg,#2b2e33,#d9dde3)",
    sheenOp: 0.42,
    sweepSec: 52,
  },
  {
    name: "Legendary",
    index: 4,
    depth: 1200,
    range: "1,200 points",
    effect: "Gold foil, warm glow.",
    border: "conic-gradient(from 210deg,#4a3f24,#d9b25f,#3a3a44,#d9b25f,#4a3f24)",
    borderFlat: "linear-gradient(130deg,#4a3f24,#d9b25f 28%,#3a3a44 52%,#d9b25f 76%,#4a3f24)",
    glow: "0 0 26px rgba(217,178,95,.25)",
    labelColor: "#d9b25f",
    swatch: "linear-gradient(120deg,#3a2f16,#d9b25f)",
    sheenOp: 0.55,
    sweepSec: 42,
  },
  {
    name: "Mythic",
    index: 5,
    depth: 2500,
    range: "2,500 points",
    effect: "Full foil, drifting light, particles.",
    border:
      "conic-gradient(from 0deg,#cfd8e3,#e7d9f0,#ecdcc0,#e6cdc8,#d6e6e0,#d3dbe6,#cfd8e3)",
    borderFlat:
      "linear-gradient(130deg,#cfd8e3,#e7d9f0 18%,#ecdcc0 40%,#e6cdc8 60%,#d6e6e0 80%,#cfd8e3)",
    rimClass: "rim-mythic",
    // Two shadows rather than one: a tight bright line that reads as the edge
    // catching light, and a wide soft bloom that reads as the light leaving it.
    glow: "0 0 0 1px rgba(236,234,230,.14), 0 0 46px rgba(236,234,230,.30)",
    labelColor: "#eceae6",
    swatch: "conic-gradient(from 0deg,#cfd8e3,#e7d9f0,#ecdcc0,#e6cdc8,#d6e6e0,#d3dbe6,#cfd8e3)",
    sheenOp: 0.7,
    sweepSec: 34,
  },
];

// ---------------------------------------------------------------------------
// LAYER 2b — LIBRARY DEPTH: the one number the ladder runs on.
//
// Depth is volume of recorded opinion, weighted by how much watching each unit
// represents. It is not breadth, not obscurity, not effort, and not taste.
// Genres, decades and reviews are worth nothing here on purpose: they used to
// promote a rank, which is what made rank and identity impossible to tell
// apart. They are collectibles now (see `COLLECTIBLES`), and collectibles never
// move a tier.

/**
 * One line of the sum, with its arithmetic intact.
 *
 * Both halves are here because the points alone cannot be checked. A panel
 * reading "Seasons, 4 each — 292" next to a library holding 73 seasons asks the
 * reader to divide before they can tell whether it is right, and most will read
 * 292 as the number of seasons instead. Printing 73 × 4 = 292 makes the line
 * verifiable at a glance, which is the entire argument for one integer.
 */
export type DepthLine = {
  key: string;
  /** what was counted, in the product's own words */
  label: string;
  /** how many there are */
  count: number;
  /** what one of them is worth */
  per: number;
  /** what the line contributes, after any cap */
  points: number;
  /**
   * True when a cap trimmed the line, so the panel can say so rather than
   * print `40 × 1 = 25` and look broken.
   */
  capped: boolean;
};

export type LibraryDepth = { depth: number; lines: DepthLine[] };

/**
 * What one season is worth, measured against a film.
 *
 * Checked against the catalogue rather than assumed. Across the seasons people
 * actually rate, a season runs 13.9 episodes: 12.4 for live action, 19.7 for
 * animation, 28.4 for anime. At ordinary per-episode durations that is roughly
 * 558, 433 and 682 minutes, against a median film of 110 and a mean of 120 —
 * so a season is about 4.5 films of watching, weighted by what gets rated.
 *
 * Four is therefore slightly conservative: it under-credits television rather
 * than over-credits it, which is the safer error for a product whose catalogue
 * is film-first.
 *
 * Deliberately not per-form. Anime would be worth 5.7 and animation 3.6, so an
 * anime watcher would climb 58% faster than an animation watcher for the same
 * number of seasons — a visible unfairness bought for a rounding error, and one
 * that would contradict anime being a kind of show rather than its own universe.
 *
 * It is stated out loud on the card. A hidden multiplier is the thing this
 * redesign exists to remove.
 */
export const SEASON_WEIGHT = 4;

/** A finished series is worth a little, and only a little. */
const COMPLETED_SHOW_POINTS = 2;
const COMPLETED_SHOW_CAP = 50;

/** Returning to something counts once per title, however often you return. */
const REWATCH_POINTS = 1;
const REWATCH_CAP = 25;

/**
 * How deep this library is, as one integer.
 *
 * Base volume dominates by construction: at the Epic threshold of 500 the two
 * bonuses together cap at 75, and only for somebody who has genuinely finished
 * twenty-five series and returned to twenty-five different titles. In the
 * catalogue as it stands, rewatches are 1.7% of all entries, so the typical
 * contribution is nearly nothing.
 *
 * A whole-series rating is worth one season, not the whole run. It is one
 * recorded opinion, and depth counts recorded opinions; crediting every aired
 * season would make a single click on a fifteen-season show worth sixty films.
 * Rating seasons individually remains the way to turn a long series into real
 * depth, which also happens to protect the strongest thing this product does by
 * making the granular path the rewarding one.
 */
export function libraryDepth(signals: TasteSignals): LibraryDepth {
  const line = (
    key: string,
    label: string,
    count: number,
    per: number,
    cap?: number,
  ): DepthLine => {
    const raw = Math.max(0, count) * per;
    const points = cap === undefined ? raw : Math.min(cap, raw);
    return { key, label, count: Math.max(0, count), per, points, capped: points < raw };
  };

  const lines: DepthLine[] = [
    line(
      "films",
      "films",
      signals.rated - signals.seasonCount - signals.wholeShowCount,
      1,
    ),
    line("seasons", "seasons", signals.seasonCount, SEASON_WEIGHT),
    /**
     * Only series with no season of their own rated.
     *
     * A card in the wild showed "8 seasons" beside "32 whole series" and "24
     * series finished", which no reader could reconcile — and underneath the
     * confusion the ladder really was being paid two and three times for one
     * series. A show rated whole *and* season by season is already counted by
     * the seasons line; a show rated whole is already counted here. Neither may
     * also collect the completion bonus below.
     */
    line("shows", "whole series", signals.wholeShowOnlyCount, SEASON_WEIGHT),
    line(
      "completed",
      "series finished season by season",
      signals.completedBySeasons,
      COMPLETED_SHOW_POINTS,
      COMPLETED_SHOW_CAP,
    ),
    line(
      "rewatched",
      "titles returned to",
      signals.repeatTitleCount,
      REWATCH_POINTS,
      REWATCH_CAP,
    ),
  ];

  return { depth: lines.reduce((sum, l) => sum + l.points, 0), lines };
}

// ---------------------------------------------------------------------------
// LAYER 2c — COLLECTIBLES: the fun that used to distort the ladder.
//
// These were milestones, and meeting three of them lifted a rank. That made
// rank a mixture of how much somebody had watched and how broadly, which is
// exactly the conflation the redesign removes. They are achievements now: they
// unlock finishes and binder plates, and they never touch depth or tier.
//
// They are not traits. A trait is an observation about what somebody watches;
// these are things somebody has done. They must not render in the traits panel.

export type CollectibleDef = {
  key: string;
  name: string;
  /** what the number counts, in the product's own words */
  unit: string;
  target: number;
  count: (s: TasteSignals) => number;
  /** the condition, stated as a fact a reader could check */
  condition: string;
};

export const COLLECTIBLES: CollectibleDef[] = [
  {
    key: "international",
    name: "International Explorer",
    unit: "titles not in English",
    target: 25,
    count: (s) => s.nonEnglishCount,
    condition: "25 rated titles in a language other than English",
  },
  {
    key: "rewatch",
    name: "Rewatch Archive",
    unit: "titles returned to",
    target: 25,
    count: (s) => s.repeatTitleCount,
    condition: "25 different titles watched more than once",
  },
  {
    key: "longform",
    name: "Longform",
    unit: "series finished",
    target: 10,
    count: (s) => s.completedShows,
    condition: "10 series watched all the way through",
  },
  {
    key: "classicist",
    name: "Classicist Collection",
    unit: "titles from before 1970",
    target: 30,
    count: (s) => s.preSeventyCount,
    condition: "30 rated titles released before 1970",
  },
  {
    key: "director",
    name: "Director Deep Dive",
    unit: "titles by one director",
    target: 8,
    count: (s) => s.maxDirectorCount,
    condition: "8 rated titles by the same director",
  },
  {
    key: "annotated",
    name: "The Annotated Shelf",
    unit: "reviews written",
    target: 50,
    count: (s) => s.reviewCount,
    condition: "50 reviews written",
  },
];

/** `count` stops being the function and becomes the number it produced. */
export type Collectible = Omit<CollectibleDef, "count"> & { count: number; held: boolean };

export function evaluateCollectibles(s: TasteSignals): Collectible[] {
  return COLLECTIBLES.map((c) => {
    const count = Math.max(0, Math.round(c.count(s)));
    return { ...c, count, held: count >= c.target };
  });
}

// ---------------------------------------------------------------------------

export type TierGate = {
  /** where this library stands */
  depth: number;
  /** the depth the next rung needs */
  need: number;
  /** how much more, so the card never makes a reader subtract */
  toNext: number;
  /** progress through the current rung, 0-100 */
  progressPct: number;
};

export type TierStanding = {
  /** the tier this library earns, now */
  tier: RarityTier;
  depth: number;
  /** the sum, line by line, with its arithmetic intact */
  lines: DepthLine[];
  /** null at the top of the ladder */
  next: RarityTier | null;
  /** how the next rung is reached; null at the top */
  gate: TierGate | null;
};

export function tierFor(depth: number): RarityTier {
  let tier = RARITY_TIERS[0];
  for (const t of RARITY_TIERS) {
    if (depth >= t.depth) tier = t;
  }
  return tier;
}

/**
 * Where somebody stands, and how the next rung is reached.
 *
 * The tier is whatever the library earns right now, with nothing held back and
 * nothing carried forward. That means rank can fall — deleting entries, hiding
 * private ones, or a change to the thresholds will all move it down — and that
 * is the deliberate trade for a rank that always describes the shelf in front of
 * you rather than the shelf you once had.
 *
 * The high-water mark is still recorded on `users.tier_floor`, but only as
 * history: the binder reads it so a finish somebody genuinely passed through
 * keeps reading as held. It never props up the tier in force.
 */
export function tierStanding(signals: TasteSignals): TierStanding {
  const { depth, lines } = libraryDepth(signals);
  const tier = tierFor(depth);

  const next = RARITY_TIERS[tier.index + 1] ?? null;
  if (!next) return { tier, depth, lines, next: null, gate: null };

  const span = Math.max(1, next.depth - tier.depth);
  return {
    tier,
    depth,
    lines,
    next,
    gate: {
      depth,
      need: next.depth,
      toNext: Math.max(0, next.depth - depth),
      progressPct: Math.max(0, Math.min(100, Math.round(((depth - tier.depth) / span) * 100))),
    },
  };
}

/** The tier in force. A thin read on `tierStanding` for callers that want only that. */
export function computeTier(signals: TasteSignals): RarityTier {
  return tierStanding(signals).tier;
}

// ---------------------------------------------------------------------------
// LAYER 3 — ARCHETYPE: era (decade) × leading genre, algorithmic and never
// chosen. Re-read every time taste changes, and printed with a plain line
// saying which decade and which genre produced it.

export const ERA_BY_DECADE: Record<number, string> = {
  1920: "Silent",
  1930: "Golden Age",
  1940: "Wartime",
  1950: "Studio",
  1960: "New Wave",
  1970: "Grindhouse",
  1980: "Neon",
  1990: "Video Store",
  2000: "Millennial",
  2010: "Streaming",
  2020: "Present Day",
};

/**
 * The genres a film can actually carry, and so the only honest denominator for
 * "how much of the map have you covered".
 *
 * TMDB's film list minus "TV Movie", which is a distribution fact rather than
 * a genre. This used to be read off `ARCHETYPE_BY_GENRE`'s key count, which
 * happened to be the same number but only by coincidence: adding an archetype
 * would have silently moved everyone's Explorer reading.
 */
export const FILM_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
] as const;

/**
 * The second word: what leads your ratings, read through what sits behind it.
 *
 * One noun per genre made every Action library "The Maximalist", and there are
 * only eighteen genres with three of them holding most people. So the genre
 * that leads picks the row and the *runner-up* picks the column, which is a
 * second real fact about a person and one that varies far more than the first:
 * Action behind Crime is a different appetite from Action behind Comedy, and
 * now it is a different word.
 *
 * Four of the six columns are what the runner-up genre is made of, not what it
 * is called: something in shadow, something warm, something built at scale, or
 * something that could not happen.
 *
 * The other two are not about genre at all. If a library leans hard enough on
 * old films or on films made outside English, that fact outranks the runner-up
 * and picks the column itself, because it is the more interesting thing about
 * the person. A horror library from before 1990 is a different appetite from a
 * horror library made abroad, and both are different from horror-then-crime,
 * so all three get their own word.
 */
type NounFamily = "shadow" | "warmth" | "scale" | "wonder" | "vintage" | "foreign";

const FAMILY_BY_GENRE: Record<string, NounFamily> = {
  Horror: "shadow",
  Thriller: "shadow",
  Crime: "shadow",
  Mystery: "shadow",
  War: "shadow",
  Comedy: "warmth",
  Family: "warmth",
  Romance: "warmth",
  Music: "warmth",
  Animation: "wonder",
  "Science Fiction": "wonder",
  Fantasy: "wonder",
  Action: "scale",
  Adventure: "scale",
  History: "scale",
  Western: "scale",
  Documentary: "scale",
  Drama: "scale",
};

/**
 * How much of the catalogue carries each genre.
 *
 * Measured across the films people actually rate, and the reason the second
 * word needed this at all: Adventure is tagged on 41% of films and Action on
 * 41%, while Western sits at 0.9%. Picking somebody's genre by raw count
 * therefore picks the same four or five genres for nearly everybody, and
 * thirteen of the eighteen rows below were unreachable. It is the "everyone is
 * Midnight" problem one level down.
 *
 * So a genre is weighed against how common it is. A library that is 12%
 * Western when Westerns are 1% of what exists is a Western library, whatever
 * else is tagged on those same films.
 *
 * Fixed rather than recomputed, for the same reason the archetype anchors are:
 * a title should not change because the catalogue grew. Floored at 2% so a
 * genre we happen to hold almost none of cannot produce a runaway score.
 */
export const GENRE_PREVALENCE: Record<string, number> = {
  Adventure: 0.415,
  Action: 0.412,
  "Science Fiction": 0.294,
  Comedy: 0.284,
  Drama: 0.284,
  Thriller: 0.224,
  // Family is deliberately absent, not forgotten. TMDB attaches it to almost
  // every animated film, so it rode along on libraries whose actual appetite
  // was Animation, and named people after a label rather than a taste. Those
  // films still count under the genres they really are. It stays a browse
  // filter and a genre chip; it just cannot name anybody.
  Fantasy: 0.191,
  Animation: 0.169,
  Crime: 0.142,
  Romance: 0.082,
  Horror: 0.069,
  Mystery: 0.064,
  War: 0.027,
  History: 0.024,
  Documentary: 0.02,
  Music: 0.02,
  Western: 0.02,
};

/**
 * The genres this library leans on hardest, most distinctive first.
 *
 * `count / total` is what share of the library carries a genre; dividing by
 * how common the genre is turns that into how much more of it this person
 * watches than the catalogue would hand them by chance. A floor of four films
 * keeps one Western from making somebody a Western viewer.
 */
export function signatureGenres(
  genres: { name: string; count: number }[],
  taggedFilms: number,
): { name: string; count: number; lift: number }[] {
  if (taggedFilms <= 0) return [];
  const floor = Math.max(4, Math.round(taggedFilms * 0.02));
  return genres
    .filter((g) => g.count >= floor && GENRE_PREVALENCE[g.name])
    .map((g) => ({
      ...g,
      lift: g.count / taggedFilms / GENRE_PREVALENCE[g.name],
    }))
    .sort((a, b) => b.lift - a.lift || b.count - a.count);
}

export const ARCHETYPE_NOUNS: Record<string, Record<NounFamily, string>> = {
  Action: { shadow: "Enforcer", warmth: "Showstopper", scale: "Maximalist", wonder: "Vanguard", vintage: "Serialist", foreign: "Border Runner" },
  Adventure: { shadow: "Outrider", warmth: "Voyager", scale: "Wanderer", wonder: "Pathfinder", vintage: "Swashbuckler", foreign: "Nomad" },
  Animation: { shadow: "Night Dreamer", warmth: "Dreamer", scale: "Worldbuilder", wonder: "Animist", vintage: "Cel Purist", foreign: "Ink Traveller" },
  Comedy: { shadow: "Cynic", warmth: "Wit", scale: "Ringleader", wonder: "Trickster", vintage: "Vaudevillian", foreign: "Absurdist" },
  Crime: { shadow: "Noirist", warmth: "Grifter", scale: "Kingpin", wonder: "Schemer", vintage: "Gumshoe", foreign: "Smuggler" },
  Documentary: { shadow: "Investigator", warmth: "Witness", scale: "Realist", wonder: "Speculator", vintage: "Archivist", foreign: "Field Reporter" },
  Drama: { shadow: "Confessor", warmth: "Humanist", scale: "Tragedian", wonder: "Visionary", vintage: "Classicist", foreign: "Neorealist" },
  Family: { shadow: "Storykeeper", warmth: "Sentimentalist", scale: "Hearthkeeper", wonder: "Wishmaker", vintage: "Matinee Kid", foreign: "Folk Tale" },
  Fantasy: { shadow: "Spellbinder", warmth: "Mythmaker", scale: "Loremaster", wonder: "Archmage", vintage: "Fabulist", foreign: "Folklorist" },
  History: { shadow: "Revisionist", warmth: "Antiquarian", scale: "Historian", wonder: "Timekeeper", vintage: "Antiquary", foreign: "Cartographer" },
  Horror: { shadow: "Nightcrawler", warmth: "Ghoul", scale: "Doomsayer", wonder: "Cosmicist", vintage: "Revenant", foreign: "Nightfarer" },
  Music: { shadow: "Nocturne", warmth: "Score Chaser", scale: "Maestro", wonder: "Rhapsodist", vintage: "Crooner", foreign: "Balladeer" },
  Mystery: { shadow: "Detective", warmth: "Puzzler", scale: "Cryptographer", wonder: "Occultist", vintage: "Sleuth", foreign: "Interpreter" },
  Romance: { shadow: "Melancholic", warmth: "Romantic", scale: "Idealist", wonder: "Starcrossed", vintage: "Old Flame", foreign: "Farsick" },
  "Science Fiction": { shadow: "Dystopian", warmth: "Stargazer", scale: "Futurist", wonder: "Cosmologist", vintage: "Retrofuturist", foreign: "Cosmopolite" },
  Thriller: { shadow: "Paranoiac", warmth: "Thrillseeker", scale: "Strategist", wonder: "Conspiracist", vintage: "Cliffhanger", foreign: "Fugitive" },
  War: { shadow: "Survivor", warmth: "Correspondent", scale: "Chronicler", wonder: "Legendkeeper", vintage: "Veteran", foreign: "Partisan" },
  Western: { shadow: "Outlaw", warmth: "Drifter", scale: "Pioneer", wonder: "Wayfarer", vintage: "Ranger", foreign: "Borderlander" },
};

/** Kept for anything still reading the flat table: the warm column. */
export const ARCHETYPE_BY_GENRE: Record<string, string> = Object.fromEntries(
  Object.entries(ARCHETYPE_NOUNS).map(([genre, set]) => [genre, set.warmth]),
);

/**
 * The title, and what each half of it actually means.
 *
 * The first word used to be the decade somebody watched most, which sounds
 * like an axis and behaves like a constant: nearly every library leans on the
 * last fifteen years, so nearly everybody got the same word.
 *
 * Replacing it with habits helped and did not go far enough, because each
 * habit had a bar to clear and most libraries cleared none: they fell through
 * to the same fallback, or to whichever bar happened to be softest. A bar
 * answers "is this remarkable in absolute terms", which is the wrong question.
 * The right one is "of everything true about this person, what is *most*
 * true", and that always has an answer.
 *
 * So every axis is scored the same way — how far from an ordinary library it
 * sits, in units of how much libraries normally vary — and the furthest one
 * wins. Nobody falls through, the word somebody gets is the thing they are
 * genuinely most extreme about, and two people who differ anywhere differ
 * here. Most axes run in both directions, so one measurement yields two very
 * different words depending on which side of ordinary you are on.
 */
export type ArchetypeRead = {
  /** the whole title, e.g. "The Underground Noirist" */
  title: string;
  /** the first word, and the fact behind it */
  modifier: string;
  modifierMeaning: string;
  /** the second word, and the fact behind it */
  noun: string;
  nounMeaning: string;
  /** both halves as one sentence, for the card */
  meaning: string;
  /** the title it nearly was, when there is one */
  nearMiss?: string;
  /** the theme that named the card, for anything else that wants to agree with it */
  themeKey: string | null;
};

type Reading = { word: string; meaning: string; score: number };

/**
 * What an ordinary library looks like on each axis, and how much libraries
 * vary around it.
 *
 * Priors rather than measured population values, deliberately: with a young
 * user base, computing these from everyone would mean the words shift under
 * people as the site grows, and an early user's title would change because
 * strangers signed up. Fixed anchors keep a title a statement about the
 * person. They are set from what film libraries generally look like, and
 * `spread` is the distance at which somebody starts being unusual.
 */
type Anchor = { typical: number; spread: number };

const ANCHOR = {
  // The shelf-composition anchors below were re-measured across the seeded
  // crowd, because the guessed ones were far enough out that a handful of
  // words won almost every title: only fourteen of the twenty-seven were ever
  // reachable. `typical` is the median and `spread` is half the 16th-to-84th
  // percentile range, which is one standard deviation for anything roughly
  // normal, and matches what spread is documented to mean here.
  //
  // Only the axes describing what sits on the shelf are set this way. What
  // somebody does with their ratings, the average, the swing, the rewatching,
  // the flat tens, is invented by the seeder rather than observed, so those
  // anchors are left where they were until there are enough real libraries to
  // measure. Calibrating them against a script's habits would name people
  // after the seeder.
  oldShare: { typical: 0.02, spread: 0.025 },
  wideShare: { typical: 0.91, spread: 0.07 },
  mean: { typical: 70, spread: 12 },
  spreadOfRatings: { typical: 13, spread: 5.5 },
  topGenreShare: { typical: 0.487, spread: 0.11 },
  subtitleShare: { typical: 0.06, spread: 0.05 },
  rewatchShare: { typical: 0.1, spread: 0.1 },
  oneDirector: { typical: 1.55, spread: 0.42 },
  // Measured across every library on the service, not guessed. The old figure
  // said a typical person rates 15% of their films far from the IMDb crowd;
  // the real median is 2.6%, so everybody scored a full standard deviation
  // into the agreeing side and one word led a third of all titles.
  criticGap: { typical: 0.042, spread: 0.051 },
  // The opinion axes. Each is a difference between two averages in tenths, so
  // zero is "rates both kinds the same" and the spread is roughly how far
  // apart a person has to hold them before it is a preference rather than
  // noise: six tenths of a point.
  obscureLift: { typical: 0, spread: 6 },
  oldLift: { typical: 0, spread: 6 },
  foreignLift: { typical: 0, spread: 6 },
  oneFace: { typical: 1.72, spread: 1.1 },
  languages: { typical: 5, spread: 2.5 },
  // Bimodal in the crowd and probably in life: people are largely film people
  // or largely television people, and the middle is thinly populated. The
  // spread is wide because of it, so only a decisive lean earns the word.
  tvShare: { typical: 0.2, spread: 0.33 },
  crowdBias: { typical: 2.3, spread: 9.2 },
  perfectShare: { typical: 0.03, spread: 0.08 },
  decimalShare: { typical: 0.6, spread: 0.35 },
} satisfies Record<string, Anchor>;

/**
 * Every reading the library supports, scored on one scale.
 *
 * Each reading divides by the films that carry its field rather than by
 * everything rated: metadata arrives lazily, and dividing by the whole shelf
 * reports "not known yet" as "not true". An axis with too little behind it is
 * not scored at all rather than scored badly.
 */
function readings(s: TasteSignals, topGenre: string | undefined): Reading[] {
  const out: Reading[] = [];
  const pct = (n: number) => Math.round(n * 100);

  /**
   * One measurement, two words.
   *
   * `high` is what to call somebody well above ordinary and `low` what to call
   * somebody well below. An axis interesting in only one direction passes null
   * for the other: there is no memorable word for watching a normal number of
   * films in your own language.
   */
  const axis = (
    value: number,
    anchor: Anchor,
    high: [string, string] | null,
    low: [string, string] | null,
  ) => {
    const z = (value - anchor.typical) / anchor.spread;
    const side = z >= 0 ? high : low;
    if (!side) return;
    out.push({ word: side[0], meaning: side[1], score: Math.abs(z) });
  };

  if (s.yearKnownCount >= 15) {
    const old = (s.eraBands[0] + s.eraBands[1]) / s.yearKnownCount;
    axis(
      old,
      ANCHOR.oldShare,
      ["Backlot", `${pct(old)}% of your films were made before 1990.`],
      ["Firstlight", `${pct(1 - old)}% of your films were made after 1990.`],
    );
  }

  if (s.voteKnownCount >= 15) {
    const wide = s.mainstreamCount / s.voteKnownCount;
    axis(
      wide,
      ANCHOR.wideShare,
      ["Fullhouse", `${pct(wide)}% of your films have been rated by thousands of people.`],
      ["Deepcut", `${pct(1 - wide)}% of your films have fewer than 2,000 ratings anywhere.`],
    );
  }

  if (s.rated >= 10 && s.mean !== null) {
    const avg = (s.mean / 10).toFixed(1);
    axis(
      s.mean,
      ANCHOR.mean,
      ["Openhand", `Your average rating is ${avg}.`],
      ["Coldwater", `Your average rating is ${avg}.`],
    );
  }

  if (s.rated >= 10 && s.ratingStdDev !== null) {
    axis(
      s.ratingStdDev,
      ANCHOR.spreadOfRatings,
      ["Faultline", "Your ratings swing hard in both directions."],
      ["Evenkeel", "Your ratings cluster close together."],
    );
  }

  if (s.genreTaggedCount >= 15 && topGenre) {
    const share = s.topGenreCount / s.genreTaggedCount;
    axis(
      share,
      ANCHOR.topGenreShare,
      ["Onetrack", `${pct(share)}% of your rated films carry ${topGenre}.`],
      ["Wideangle", `You spread across ${s.distinctGenres} genres with no single one dominating.`],
    );
  }

  if (s.languageKnownCount >= 15) {
    const sub = s.nonEnglishCount / s.languageKnownCount;
    axis(
      sub,
      ANCHOR.subtitleShare,
      ["Farshore", `${pct(sub)}% of your films were not made in English.`],
      null,
    );
  }

  if (s.totalEntryCount >= 20) {
    const again = s.rewatchEntryCount / s.totalEntryCount;
    axis(
      again,
      ANCHOR.rewatchShare,
      ["Secondrun", `${pct(again)}% of your viewings are rewatches.`],
      ["Shortfuse", "You almost never watch the same film twice."],
    );
  }

  if (s.directorKnownCount >= 15) {
    axis(
      s.topDirectorLift,
      ANCHOR.oneDirector,
      [
        "Housename",
        s.topDirectorName
          ? `You have rated ${s.maxDirectorCount} films directed by ${s.topDirectorName}, well past what chance would give you.`
          : `You keep returning to one director.`,
      ],
      null,
    );
    // The cast equivalent, which says something the director axis does not: a
    // person can follow a face across films by twelve different directors.
    // Measured against how much of the catalogue that actor is actually in.
    // Counting heads made this fire for anyone who had seen a franchise: the
    // same lead in eleven films is what a franchise is, not what following
    // somebody is.
    axis(
      s.topCastLift,
      ANCHOR.oneFace,
      [
        "Marquee",
        s.topCastName
          ? `${s.topCastName} turns up in ${s.maxCastCount} of your films, more than chance would give you.`
          : `You keep returning to the same faces.`,
      ],
      null,
    );
  }

  if (s.languageKnownCount >= 15) {
    axis(
      s.distinctLanguages,
      ANCHOR.languages,
      ["Borderless", `You have rated films in ${s.distinctLanguages} different languages.`],
      null,
    );
  }

  /**
   * Which half of the catalogue somebody actually lives in.
   *
   * Every other shelf reading counts a season as one more title, which is
   * right for counting and hides the thing people most visibly differ on. A
   * library four fifths television and one four fifths film are two different
   * habits wearing the same numbers, and until seasons existed there was no
   * way for a title to say which one you are.
   */
  if (s.rated >= 20) {
    const tv = (s.seasonCount + s.wholeShowCount) / s.rated;
    axis(
      tv,
      ANCHOR.tvShare,
      ["Boxset", `${pct(tv)}% of what you rate is television.`],
      ["Singlereel", `${pct(1 - tv)}% of what you rate is film.`],
    );
  }

  if (s.imdbKnownCount >= 15) {
    const gap = s.imdbGapCount / s.imdbKnownCount;
    axis(
      gap,
      ANCHOR.criticGap,
      ["Crosswise", `${pct(gap)}% of your ratings sit far from the IMDb crowd.`],
      // No word for the other side. Landing near the IMDb crowd is what almost
      // everybody does, because that average is itself a crowd: it described
      // three quarters of the service and named a third of it, which is a
      // default dressed up as an identity.
      null,
    );
  }

  /**
   * What you make of what you watched, rather than what you watched.
   *
   * Everything above reads the shelf, and shelves converge: the popular films
   * are popular, so two people who watch what everybody watches score alike on
   * every one of them. These read the ratings instead. Holding the obscure
   * half of your library above the famous half, or the old above the new, is a
   * fact about you that survives owning the same films as everybody else, and
   * it is the one thing nobody can arrive at by accident.
   */
  const tenths = (n: number) => (Math.abs(n) / 10).toFixed(1);

  if (s.meanObscure !== null && s.meanFamous !== null) {
    const lift = s.meanObscure - s.meanFamous;
    axis(
      lift,
      ANCHOR.obscureLift,
      [
        "Offbook",
        `You rate the least-known films in your library ${tenths(lift)} higher than the famous ones.`,
      ],
      [
        "Mainline",
        `You rate the famous films in your library ${tenths(lift)} higher than the obscure ones.`,
      ],
    );
  }

  if (s.meanOld !== null && s.meanNew !== null) {
    const lift = s.meanOld - s.meanNew;
    axis(
      lift,
      ANCHOR.oldLift,
      ["Rearview", `You rate films made before 1990 ${tenths(lift)} higher than newer ones.`],
      ["Freshprint", `You rate films made since 1990 ${tenths(lift)} higher than older ones.`],
    );
  }

  if (s.meanForeign !== null && s.meanEnglish !== null) {
    const lift = s.meanForeign - s.meanEnglish;
    axis(
      lift,
      ANCHOR.foreignLift,
      ["Worldwise", `You rate films made outside English ${tenths(lift)} higher than English ones.`],
      null,
    );
  }

  if (s.imdbBias !== null) {
    axis(
      s.imdbBias,
      ANCHOR.crowdBias,
      ["Sameside", `You rate ${tenths(s.imdbBias)} above the IMDb score on average.`],
      ["Hardline", `You rate ${tenths(s.imdbBias)} below the IMDb score on average.`],
    );
  }

  if (s.rated >= 20) {
    const tens = s.perfectTenCount / s.rated;
    axis(
      tens,
      ANCHOR.perfectShare,
      ["Fullmark", `${pct(tens)}% of your ratings are a flat 10.0.`],
      null,
    );

    const decimals = s.decimalRatingCount / s.rated;
    axis(
      decimals,
      ANCHOR.decimalShare,
      ["Hairline", `${pct(decimals)}% of your ratings use the decimal.`],
      ["Hardstop", `${pct(1 - decimals)}% of your ratings are round numbers.`],
    );
  }

  return out;
}

/**
 * The clusters a library leans on, most distinctive first.
 *
 * Same arithmetic as everything else here: your share of a theme against how
 * much of the catalogue carries it, so a theme that is everywhere has to be
 * everywhere in *your* library before it names you. Four films minimum, or a
 * single heist would make somebody a thief.
 *
 * A theme also has to be ahead of ordinary by a margin, not merely ahead. The
 * count floor alone let a library of nature documentaries and Chernobyl come
 * back named for sitcoms, on four matches at 1.2x, because nothing in it
 * matched anything and 1.2x was the best on offer. Winning a field of nothing
 * is not a signature, and there is already a genre reading for exactly this
 * case, so below the margin the title falls through to it rather than
 * inventing a theme out of noise.
 */
function signatureClusters(counts: Record<string, number>, total: number) {
  if (total <= 0) return [];
  const floor = Math.max(4, Math.round(total * 0.02));

  /**
   * Five pseudo-films, added to both sides of the ratio.
   *
   * A plain share-over-prevalence hands rare themes enormous scores: four
   * courtroom films against a theme carrying 1.3% of the catalogue reads as
   * "three times normal", and in simulation that alone won 12% of libraries.
   * Shrinking toward one until the evidence is thick enough is the standard
   * cure, and it moved the spread from four themes dominating to thirty-nine
   * of the forty-three winning somewhere, none above 6%.
   */
  const PRIOR = 5;

  /**
   * How far past ordinary a theme must sit before it can name somebody.
   *
   * Set just under the median winning lift across the seeded crowd, which is
   * 1.68x: high enough to drop the eight libraries being named for something
   * they barely over-watch, low enough that a genuine but mild concentration
   * still counts.
   */
  const MARGIN = 1.35;

  const ranked = CLUSTERS.map((c) => {
    const count = counts[c.key] ?? 0;
    const expected = total * (CLUSTER_PREVALENCE[c.key] ?? 0.05);
    return { cluster: c, count, lift: (count + PRIOR) / (expected + PRIOR) };
  })
    .filter((r) => r.count >= floor && r.lift >= MARGIN)
    .sort((a, b) => b.lift - a.lift || b.count - a.count);

  /**
   * A near-tie goes to the bigger theme.
   *
   * Somebody concentrated in one genre has three sibling themes at the top,
   * separated by a couple of points of catalogue prevalence rather than by
   * anything about them: fifty-one slashers can lose to forty-six occult films
   * purely because the catalogue holds slightly more slashers. That is noise
   * deciding a name, and it flips as the library grows.
   *
   * So within a tenth of the leader, the theme carrying more films wins. It is
   * the more substantial claim, and it is the one that stays put.
   */
  /**
   * A format only leads a shelf it dominates.
   *
   * Anime, animation and adult cartoons are mediums rather than subjects, and
   * a medium contains every subject there is. Left to compete on volume they
   * won constantly: a shelf a third anime was named for the anime, printed on
   * its stock, and stayed there — while the tournaments, ghost stories and
   * family dramas inside it, which is what that person actually watches, never
   * got a look in. Below the share where the format is genuinely the point,
   * the reading falls through to what those titles are about. Above it the
   * format is the honest answer and leads normally.
   *
   * Demoted rather than dropped: a format that cannot name somebody can still
   * be a finish they hold, because they really do watch that much of it.
   */
  const leads = ranked.filter(
    (r) => !FORMAT_CLUSTERS.has(r.cluster.key) || r.count / total >= FORMAT_LEAD_SHARE,
  );
  const demoted = ranked.filter((r) => !leads.includes(r));

  const lead = leads[0];
  if (lead) {
    const contenders = leads.filter((r) => r.lift >= lead.lift * 0.9);
    const biggest = contenders.reduce((a, b) => (b.count > a.count ? b : a), lead);
    if (biggest !== lead) {
      return [biggest, ...leads.filter((r) => r !== biggest), ...demoted];
    }
  }
  return [...leads, ...demoted];
}

/**
 * The themes a library actually runs on, strongest first.
 *
 * The card's DNA strip used to list the five biggest genre tags, which meant
 * it read Adventure / Action / Comedy for most people: the same collapse as
 * everywhere else, in the most prominent block on the back of the card. These
 * are ranked by how far past ordinary each theme sits, and the figure printed
 * beside each is its true share of the library, not a share rescaled to fill
 * the bar.
 */
export type ThemeReading = {
  key: string;
  /** the plain category word, for a chart about films */
  name: string;
  /** what the theme actually is, in a reader's own words */
  note: string;
  count: number;
  pct: number;
};

/**
 * How a shelf divides, as a whole.
 *
 * This used to print the multiple beside a share and order by the multiple,
 * which asked one block to answer two different questions at once. The
 * multiple says what is *distinctive* about a library and is the right tool
 * for naming somebody, which is what the archetype still uses it for. A
 * breakdown asks what a shelf is *made of*, and for that a share is the honest
 * figure — but only if the shares are a partition. Overlapping ones added to
 * no fixed number, so four bars reading 24, 24, 21 and 18 gave a reader no way
 * to know whether that was most of their shelf or a third of it.
 *
 * So: every film filed under one theme, biggest share first, and a last row
 * carrying everything not shown. The rows always total 100 because they are
 * the same films counted once each.
 */
export function themeReadings(s: TasteSignals, take = 5): ThemeReading[] {
  const total = s.clusterFilmCount;
  if (total <= 0) return [];

  const ranked = CLUSTERS.map((c) => ({ cluster: c, count: s.clustersExclusive[c.key] ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const shown = ranked.slice(0, take);
  const rows: ThemeReading[] = shown.map((r) => ({
    key: r.cluster.key,
    name: clusterLabel(r.cluster),
    note: r.cluster.note,
    count: r.count,
    pct: Math.round((r.count / total) * 100),
  }));

  /**
   * The remainder, named rather than dropped.
   *
   * It is two things at once — themes too small to list, and films that match
   * no theme at all — and both are genuinely "the rest of the shelf", so they
   * are one row. Its share is computed as what is left after the rows above
   * rather than from its own count, which is what guarantees the column adds
   * to exactly 100 after rounding instead of to 99 or 101.
   */
  const rest = total - shown.reduce((sum, r) => sum + r.count, 0);
  if (rest > 0) {
    rows.push({
      key: "rest",
      name: "Everything else",
      note: "themes too small to list, and films that fit none of them",
      count: rest,
      pct: 100 - rows.reduce((sum, r) => sum + r.pct, 0),
    });
  }
  return rows;
}

export function themeDNA(
  s: TasteSignals,
  take = 5,
): { key: string; name: string; pct: number }[] {
  return themeReadings(s, take).map(({ key, name, pct }) => ({ key, name, pct }));
}

export function readArchetype(
  topGenre: string | undefined,
  topGenres: { name: string; count: number }[],
  s: TasteSignals,
): ArchetypeRead {
  const themes = signatureClusters(s.clusters, s.clusterFilmCount);
  const ranked = readings(s, topGenre).sort((a, b) => b.score - a.score);

  /**
   * Pairs where the two words say the same thing twice.
   *
   * The slots are measured independently and neither knows what the other
   * chose, so nothing stopped "Secondrun Repeat Offender" or the sitcom
   * watcher who came out "Fullhouse Roommate". Both halves are individually
   * correct, which is what makes it hard to see coming: the fault is only in
   * the pairing. The runner-up word is used instead, which costs nothing,
   * because these are near-ties by definition.
   */
  const RESTATES: Record<string, string[]> = {
    loop: ["Secondrun"],
    period: ["Backlot", "Rearview"],
    sitcom: ["Fullhouse"],
    comingofage: ["Firstlight"],
    outsider: ["Farshore", "Borderless"],
    stage: ["Marquee"],
  };
  const blocked = new Set(themes[0] ? RESTATES[themes[0].cluster.key] ?? [] : []);
  const best = ranked.find((r) => !blocked.has(r.word)) ?? ranked[0];

  const modifier = best?.word ?? "Unexposed";
  const modifierMeaning =
    best?.meaning ?? "Not enough on file yet to say what stands out about how you watch.";

  // ---- the noun, from what the library keeps returning to -----------------
  if (themes[0]) {
    const top = themes[0];
    const share = Math.round((top.count / s.clusterFilmCount) * 100);

    /**
     * The runner-up, and how close it came.
     *
     * A title is more interesting for the one it nearly was, and the number is
     * real: this is how many more of that theme would have overtaken the
     * winner, given both are measured against how common they are.
     */
    let nearMiss: string | undefined;
    const next = themes[1];
    if (next) {
      const needed = Math.ceil(
        top.lift * (CLUSTER_PREVALENCE[next.cluster.key] ?? 0.05) * s.clusterFilmCount -
          next.count,
      );
      nearMiss =
        needed > 0 && needed <= 8
          ? `${needed} more ${needed === 1 ? "title" : "titles"} about ${next.cluster.note} and you would be ${next.cluster.name}.`
          : `Closest behind: ${next.cluster.name}.`;
    }

    /**
     * Lift chooses; share speaks.
     *
     * The multiple is the right way to *pick* a theme \u2014 it finds what is
     * distinctive about a shelf rather than what is merely common on every
     * shelf \u2014 and the wrong way to state one. "1.8\u00d7 what a shelf that size
     * usually holds" measures against a prevalence table the reader cannot
     * see, so it is a number nobody can check, printed beside one they can.
     * Both figures here are countable off their own library, and the typical
     * share is named outright instead of folded into a ratio.
     */
    const typical = Math.round((CLUSTER_PREVALENCE[top.cluster.key] ?? 0.05) * 100);
    const nounMeaning =
      `${top.count} of your titles are about ${top.cluster.note}` +
      `, ${share}% of your shelf, where most shelves sit near ${typical}%.`;

    return {
      themeKey: top.cluster.key,
      title: `${modifier} ${top.cluster.name}`,
      modifier,
      modifierMeaning,
      noun: top.cluster.name,
      nounMeaning,
      nearMiss,
      meaning: `${nounMeaning} ${modifierMeaning}`,
    };
  }

  // ---- fallback: too few films for any theme to stand out ------------------
  // The genre reading, which needs nothing but a handful of tags, so a new
  // library still gets a title rather than a blank.
  const signature = signatureGenres(topGenres, s.genreTaggedCount);
  const lead = signature[0]?.name ?? topGenre;
  const second = signature[1]?.name ?? lead;
  const family: NounFamily = (second ? FAMILY_BY_GENRE[second] : undefined) ?? "scale";
  const set = lead ? ARCHETYPE_NOUNS[lead] : undefined;
  const noun = set ? set[family] : "Cinephile";
  const nounMeaning = lead
    ? `${lead} leads your rated films. Rate more and a theme takes over from the genre.`
    : "No genre stands out in your rated films yet.";

  return {
    themeKey: null,
    title: `${modifier} ${noun}`,
    modifier,
    modifierMeaning,
    noun,
    nounMeaning,
    meaning: `${nounMeaning} ${modifierMeaning}`,
  };
}

// ---------------------------------------------------------------------------
// LAYER 4 — VARIANT: three hidden axes, dealt from real signals nobody picks.
// Stock reads dominant genre, accent reads the decade you rate *highest* (not
// just most), aura reads your overall mean.

export type Variant = {
  /** the finish's printed name; the stock is the finish now */
  name: string;
  stock: string;
  accent: string;
  aura: string;
  accentColor: string;
  /**
   * Every finish this library has earned, printed or not.
   *
   * The card wears one; the binder should show all of them as held. Recorded
   * on each read, so a finish earned and then watched past is kept.
   */
  held: string[];
};

const GENRE_STOCK: Record<string, string> = {
  Drama: "Vellum",
  Romance: "Vellum",
  Family: "Vellum",
  Music: "Vellum",
  Horror: "Neon Rain",
  Thriller: "Neon Rain",
  Mystery: "Neon Rain",
  Crime: "Neon Rain",
  Action: "Filmstrip",
  Adventure: "Filmstrip",
  War: "Filmstrip",
  Documentary: "Marble",
  History: "Marble",
  "Science Fiction": "Nebula",
  Fantasy: "Nebula",
  Animation: "Nebula",
};

/**
 * The finish, from the same reading that names the card.
 *
 * The stock used to come from the leading genre by raw count, which gave 77%
 * of libraries Filmstrip and nobody Marble. It now follows the signature
 * theme, so the material agrees with the title: a Harvest Watcher arrives on
 * Neon Rain rather than on whatever genre tag happened to be commonest.
 */
export function computeVariant(
  signals: TasteSignals,
  topGenre: string | undefined,
  topRatedDecade: number | null,
  topDecade: number | null,
  mean: number | null,
): Variant {
  /**
   * The stock answers to taste; the archetype answers to the record.
   *
   * Read flat, the finish was an argmax that could never move: a library that
   * is mostly one thing was issued one stock on its first hundred films and
   * was still being issued it a decade later, so nine of the ten finishes in
   * the binder were unreachable for that person by construction. The
   * collection machinery was already there — `held_variants` keeps a row per
   * finish and never moves `first_held_at` — and the issuing rule was what
   * starved it.
   *
   * So the printed finish reads the weighted library, where a recent viewing
   * counts for more than an old one. Not a window: a cut-off is a clock, and
   * it decides a finish by the calendar rather than by what somebody watches.
   * The name a card carries still reads the plain record, because that is the
   * claim about who they are rather than about what they are watching now.
   */
  const current = signatureClusters(signals.clustersWeighted, signals.clusterFilmCount);
  const lifetime = signatureClusters(signals.clusters, signals.clusterFilmCount);

  /**
   * The weighted reading can come back empty where the plain one does not, on
   * a library thin enough that discounting spreads it under the threshold. The
   * record still stands in that case: a thing already shown to somebody is not
   * taken back, the same principle as `tier_floor`.
   */
  const theme = current[0] ?? lifetime[0];
  const stock =
    (theme && STOCK_BY_CLUSTER[theme.cluster.key]) ||
    (topGenre && GENRE_STOCK[topGenre]) ||
    "Bare";

  /**
   * Every finish the library has ever earned, not just the one it wears.
   *
   * Only the winner was ever recorded, which is why a binder could sit at one
   * held finish forever. Anything clearing the margin over the lifetime
   * reading is genuinely held — the person really does watch that much of it —
   * and holding is permanent anyway, so it is read lifetime rather than over
   * the window.
   */
  const held = [
    ...new Set(
      [...lifetime, ...current]
        .map((r) => STOCK_BY_CLUSTER[r.cluster.key])
        .filter((name): name is string => Boolean(name))
        .concat(stock === "Bare" ? [] : [stock]),
    ),
  ];

  // The name is decided here; the colour is looked up, never restated. These
  // two used to carry their own copies of the same four hexes, so softening
  // the accents changed the card and left the binder printing the old ones.
  const decade = topRatedDecade ?? topDecade;
  const accent =
    decade === null || (decade >= 1970 && decade < 2000)
      ? "Cobalt"
      : decade < 1970
        ? "Crimson"
        : decade < 2015
          ? "Emerald"
          : "Amethyst";
  const accentColor = accentColorOf(accent);

  // Cut on the real spread of how people rate rather than round numbers.
  // The old bands put Analog above 9.0, which nobody reaches, and used it as
  // the value for "nothing rated yet" as well, so one label meant two things
  // and one of them never happened.
  let aura: string;
  if (mean === null) aura = "Unexposed";
  else if (mean < 62) aura = "Noir";
  else if (mean < 72) aura = "Dream";
  else if (mean < 82) aura = "Cosmic";
  else aura = "Analog";

  return { name: stock, stock, accent, aura, accentColor, held };
}

// ---------------------------------------------------------------------------
// TRAITS — eighteen, none announced. A quiet dot shows on the card front when
// a new one unlocks; they only ever list on the back / in the popup.

export type TraitDef = {
  key: string;
  name: string;
  /** what the number counts, in the product's own words */
  unit: string;
  /** three thresholds; the first is where the trait starts existing at all */
  rungs: readonly [number, number, number];
  count: (s: TasteSignals) => number;
  /** which half of the catalogue can earn it */
  side: "film" | "show" | "both";
};

/**
 * The traits, and what each one actually asks for.
 *
 * Two rules decide what belongs here. A trait must be about *what somebody
 * watches*, not how much: films logged, genres covered, decades explored,
 * reviews written and rewatches recorded are the five conditions the tier
 * ladder already runs on, and a trait restating one of them says the same
 * thing twice under a second name. And no two traits may be the same
 * observation at different strengths, which is what "films from this year" and
 * "films watched in their release year" were.
 *
 * The condition is written as a plain sentence rather than a formula. "20+
 * ratings, tight spread" is a note to whoever wrote it; "Twenty ratings that
 * mostly land close together" is something a reader can check against their
 * own library.
 */
/**
 * The catalogue.
 *
 * Every rung is a real count somebody can check against their own diary, and
 * the first rung of each is deliberately low: a trait nobody can start is a
 * trait that does not exist. Six of the previous twenty were held by nobody at
 * all, because their only threshold was also their hardest.
 *
 * Roughly two in five are television, which is the same weighting the ladder
 * uses. A season is five films of watching, so a catalogue that offered one
 * show trait out of twenty would be describing a different product.
 */
export const TRAIT_DEFS: TraitDef[] = [
  // ---- when things were made ------------------------------------------
  {
    key: "silent",
    name: "Early Cinema",
    unit: "made before 1950",
    rungs: [1, 5, 15],
    count: (s) => s.preFiftyCount,
    side: "film",
  },
  {
    key: "oldguard",
    name: "Old Guard",
    unit: "from the 1950s and 60s",
    rungs: [3, 12, 30],
    count: (s) => s.midCenturyCount,
    side: "film",
  },
  {
    key: "sameyear",
    name: "Opening Week",
    unit: "watched the year they came out",
    rungs: [10, 15, 25],
    count: (s) => s.sameYearWatchCount,
    side: "both",
  },

  // ---- who you follow ---------------------------------------------------
  {
    key: "onedirector",
    name: "One Director",
    unit: "by a single director",
    rungs: [6, 9, 14],
    count: (s) => s.maxDirectorCount,
    side: "film",
  },
  {
    key: "regularface",
    name: "Regular Face",
    unit: "with the same actor",
    rungs: [8, 11, 15],
    count: (s) => s.maxCastCount,
    side: "both",
  },

  // ---- shape of a watch -------------------------------------------------
  {
    key: "marathon",
    name: "Marathon Runner",
    unit: "over two and a half hours",
    rungs: [18, 26, 40],
    count: (s) => s.longFilmCount,
    side: "film",
  },
  {
    key: "quickcuts",
    name: "Quick Cuts",
    // Was fifteen under 85 minutes, which nobody reached. Short films are a
    // deliberate habit, so the first rung is where the habit becomes visible.
    unit: "under 85 minutes",
    rungs: [5, 7, 10],
    count: (s) => s.shortFilmCount,
    side: "film",
  },
  {
    key: "rewatcher",
    name: "Comfort Rewatcher",
    // Was one film watched five times. Almost nobody logs a fifth rewatch, so
    // this now counts the habit rather than a single extreme case.
    unit: "watched more than once",
    rungs: [4, 10, 20],
    count: (s) => s.repeatTitleCount,
    side: "both",
  },

  // ---- how you rate -----------------------------------------------------
  {
    key: "perfectten",
    name: "Perfect Ten",
    unit: "rated a flat 10.0",
    rungs: [6, 15, 30],
    count: (s) => s.perfectTenCount,
    side: "both",
  },
  {
    key: "toughcritic",
    name: "Tough Critic",
    unit: "rated 3.0 or lower",
    rungs: [3, 10, 25],
    count: (s) => s.harshCount,
    side: "both",
  },
  {
    key: "precisionist",
    name: "Precisionist",
    unit: "rated on the decimal",
    rungs: [90, 130, 220],
    count: (s) => s.decimalRatingCount,
    side: "both",
  },
  {
    key: "spectrum",
    name: "Wide Spectrum",
    unit: "distinct ratings used",
    rungs: [14, 18, 24],
    count: (s) => s.distinctRatings,
    side: "both",
  },

  // ---- where you look ---------------------------------------------------
  {
    key: "subtitles",
    name: "Reads the Subtitles",
    unit: "not in English",
    rungs: [15, 28, 50],
    count: (s) => s.nonEnglishCount,
    side: "both",
  },
  {
    key: "worldtour",
    name: "World Tour",
    unit: "languages on the shelf",
    rungs: [7, 9, 12],
    count: (s) => s.distinctLanguages,
    side: "both",
  },
  {
    key: "offbeaten",
    name: "Off the Beaten Path",
    unit: "that never found an audience",
    rungs: [22, 30, 45],
    count: (s) => s.obscureCount,
    side: "both",
  },
  {
    key: "deepcut",
    name: "Deep Cut",
    unit: "in one genre",
    rungs: [80, 115, 170],
    count: (s) => s.topGenreCount,
    side: "both",
  },

  // ---- you against the room ---------------------------------------------
  {
    key: "criticsagree",
    name: "Critics Agree",
    unit: "you and the critics both loved",
    rungs: [20, 35, 60],
    count: (s) => s.criticsAgreeCount,
    side: "film",
  },
  {
    key: "againstgrain",
    name: "Against the Grain",
    unit: "you loved and critics did not",
    rungs: [6, 14, 25],
    count: (s) => s.againstGrainCount,
    side: "film",
  },
  {
    key: "secondopinion",
    name: "Second Opinion",
    unit: "far from the IMDb crowd",
    rungs: [5, 10, 20],
    count: (s) => s.imdbGapCount,
    side: "both",
  },

  // ---- television -------------------------------------------------------
  // Two in five of the catalogue, and none of these is a film trait with the
  // word changed: every one of them needs a season to be a rated thing.
  {
    key: "seasons",
    name: "Season Ticket",
    unit: "seasons rated",
    rungs: [40, 60, 100],
    count: (s) => s.seasonCount,
    side: "show",
  },
  {
    key: "shows",
    name: "Channel Surfer",
    unit: "different series",
    rungs: [15, 22, 35],
    count: (s) => s.showsTouched,
    side: "show",
  },
  {
    key: "distance",
    name: "Went the Distance",
    unit: "series rated end to end",
    rungs: [4, 7, 12],
    count: (s) => s.completedShows,
    side: "show",
  },
  {
    key: "longrun",
    name: "Long Haul",
    unit: "seasons of one series",
    rungs: [8, 14, 25],
    count: (s) => s.longestRun,
    side: "show",
  },
  {
    key: "felloff",
    name: "Fell Off",
    // Only a diary that rates seasons separately can know this, which is the
    // whole argument for rating them separately.
    unit: "series that lost you along the way",
    rungs: [1, 3, 8],
    count: (s) => s.fellOffCount,
    side: "show",
  },
  {
    key: "grewinto",
    name: "Grew Into It",
    unit: "series that got better",
    rungs: [1, 3, 8],
    count: (s) => s.grewCount,
    side: "show",
  },
  {
    key: "anime",
    name: "Subbed and Dubbed",
    unit: "anime seasons",
    rungs: [6, 18, 40],
    count: (s) => s.animeSeasonCount,
    side: "show",
  },
  {
    key: "closedbook",
    name: "Closed Book",
    unit: "seasons of series that have ended",
    rungs: [28, 40, 60],
    count: (s) => s.endedSeasonCount,
    side: "show",
  },
];

export type Trait = {
  key: string;
  name: string;
  unit: string;
  side: "film" | "show" | "both";
  count: number;
  rungs: readonly [number, number, number];
  /** 0 before the first rung, then 1, 2 or 3 */
  level: number;
  held: boolean;
  /** what has been reached, or what is next */
  cond: string;
  /** how many more for the next rung; null once all three are past */
  toNext: number | null;
};

// No "X% of filmgoers hold this" here — with a young, small user base that
// number is either a meaningless 25%/50% or missing outright, not a genuine
// rarity signal. The condition text is the reward; whether you've met it is
// the only other thing worth showing.
export function evaluateTraits(s: TasteSignals): Trait[] {
  return TRAIT_DEFS.map((t) => {
    const count = Math.max(0, Math.round(t.count(s)));
    const level = t.rungs.filter((r) => count >= r).length;
    const next = t.rungs.find((r) => count < r) ?? null;
    return {
      key: t.key,
      name: t.name,
      unit: t.unit,
      side: t.side,
      count,
      rungs: t.rungs,
      level,
      held: level > 0,
      // Reads as a fact once earned and as a target before that, which is the
      // difference between a badge and something worth chasing.
      cond:
        level > 0
          ? `${count} ${t.unit}`
          : `${t.rungs[0]} ${t.unit}`,
      toNext: next === null ? null : next - count,
    };
  });
}

/** Held traits, strongest first: level, then how far past its last rung. */
export function rankTraits(traits: Trait[]): Trait[] {
  return traits
    .filter((t) => t.held)
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      const aPast = a.count / a.rungs[Math.max(0, a.level - 1)];
      const bPast = b.count / b.rungs[Math.max(0, b.level - 1)];
      return bPast - aPast;
    });
}

// ---------------------------------------------------------------------------
// THE FINISHES, ENUMERATED. `computeVariant` names a finish but never described
// one; the binder has to render every finish that exists, including the ones
// nobody holds, so each axis needs its material and the condition that issues
// it spelled out. These are the same strings `computeVariant` returns — one
// source for the name, one for what it looks like.

export type StockDef = {
  name: string;
  /**
   * The CSS ground this stock prints on.
   *
   * Kept to plain gradients on purpose: the shareable card image is drawn by
   * Satori, which reads this and nothing else, and supports only a narrow
   * subset of CSS.
   */
  material: string;
  /** what reads to it, in the user's own terms */
  condition: string;
  /** an inner texture layered over the ground; null for a plain stock */
  texture: string | null;
};

export const STOCK_DEFS: StockDef[] = [
  {
    name: "Vellum",
    material: "linear-gradient(150deg,#2b2620,#3b352b)",
    condition:
      "Your films keep returning to people and rooms: families, first loves, grief, small towns, faith, the stage.",
    texture: "repeating-linear-gradient(102deg,rgba(236,234,230,.014) 0 1px,transparent 1px 6px)",
  },
  {
    name: "Neon Rain",
    material: "linear-gradient(150deg,#111820,#1d2c3c)",
    condition:
      "Your films keep returning to the dark: noir, investigations, tradecraft, the occult, and whatever is standing behind you.",
    texture: "repeating-linear-gradient(74deg,rgba(143,174,204,.02) 0 1px,transparent 1px 10px)",
  },
  /**
   * Silver: the same light Nebula and Neon Rain are made of, with the colour
   * taken out of it.
   *
   * The old ground was graphite on graphite with 1px hairlines at two percent
   * opacity, under the threshold where anything is visible at all, so the
   * loudest shelves in the product drew a card that looked like a finish that
   * had failed to load. What it was missing was not a hue: it was the soft
   * raking blooms that give the other two stocks their depth.
   *
   * So it is built the way Nebula is, two washes crossing a two-tone ground,
   * and lit in near-white instead of amethyst. The fine diagonal rule is Neon
   * Rain's, whitened. Filmstrip sits brighter and cooler than Marble, which is
   * the other neutral here: Marble is a diffuse, warm, low-contrast paper, and
   * this is a metal.
   */
  {
    name: "Filmstrip",
    material: "linear-gradient(150deg,#26272e,#474a55)",
    condition:
      "Your films keep returning to motion: heists, revenge, blades, engines, the front line, the open road.",
    texture: [
      "radial-gradient(68% 54% at 74% 22%,rgba(236,234,230,.055),transparent 60%)",
      "radial-gradient(58% 48% at 22% 78%,rgba(236,234,230,.032),transparent 56%)",
      // The horizontal rule this stock has always had, kept at its original
      // 9px rhythm. It was invisible before only because it sat on graphite;
      // on a silver ground the same hairline finally reads, which is the whole
      // reason the stock looked unfinished rather than quiet.
      "repeating-linear-gradient(0deg,rgba(236,234,230,.026) 0 1px,transparent 1px 9px)",
    ].join(","),
  },
  /**
   * Verde antico, and veined rather than washed.
   *
   * Marble was a second neutral, and once Filmstrip took the silver the two
   * were the same card in two values. Green is the one hue nothing else here
   * owns, and green marble is the stone of libraries, courthouses and museums,
   * which is exactly what this reads to. The texture is veining now: two soft
   * washes made it a grey card with a name, and the name is the whole point.
   */
  {
    name: "Marble",
    material: "linear-gradient(150deg,#1b241f,#2e4034)",
    condition:
      "Your films keep returning to the record and to remarks upon it: what happened, when it happened, and the joke somebody made about it.",
    texture: [
      "repeating-linear-gradient(102deg,transparent 0 31px,rgba(236,234,230,.030) 31px 32px,transparent 32px 74px)",
      "repeating-linear-gradient(97deg,transparent 0 53px,rgba(236,234,230,.018) 53px 54px,transparent 54px 119px)",
      "radial-gradient(96% 72% at 24% 16%,rgba(236,234,230,.024),transparent 62%)",
    ].join(","),
  },
  /**
   * The four below were carved from measured distribution, not invented.
   *
   * Across 83 libraries, Neon Rain was winning 43% and Nebula 27%: between
   * them they held seven in ten shelves, which is the same failure the genre
   * mapping had before, where 77% of libraries came out Filmstrip. A finish
   * that most people hold says nothing about any of them.
   *
   * Each of these takes a cluster that was already winning on its own and was
   * being filed under a coat that did not fit it. Witches are not detectives;
   * dragons are not spacecraft; a talking animal is not a lost astronaut; and
   * a film about a man who cannot trust his own memory has nothing to do with
   * a police procedural.
   */
  {
    name: "Oxblood",
    material: "linear-gradient(150deg,#22141a,#3f2028)",
    condition:
      "Your films keep returning to what should not be there: witches, cults, possession, the dead who will not stay down, the thing under the skin.",
    texture: [
      "radial-gradient(72% 56% at 76% 20%,rgba(236,234,230,.05),transparent 60%)",
      "radial-gradient(60% 50% at 20% 82%,rgba(196,117,106,.045),transparent 58%)",
      "repeating-linear-gradient(0deg,rgba(236,234,230,.016) 0 1px,transparent 1px 7px)",
    ].join(","),
  },
  {
    name: "Bromide",
    material: "linear-gradient(150deg,#251d24,#42313c)",
    condition:
      "Your films keep returning to a mind that will not hold still: amnesia, dreams, doubles, and a story told by somebody who is not sure it happened.",
    texture: [
      "radial-gradient(110% 84% at 34% 26%,rgba(236,234,230,.05),transparent 68%)",
      "radial-gradient(88% 70% at 74% 84%,rgba(236,234,230,.035),transparent 64%)",
    ].join(","),
  },
  {
    name: "Gilt",
    material: "linear-gradient(150deg,#1e1810,#463618)",
    condition:
      "Your films keep returning to magic and prophecy: wizards, dragons, sworn oaths, and the blade only one person can lift.",
    texture: [
      "radial-gradient(66% 52% at 72% 24%,rgba(217,178,95,.07),transparent 60%)",
      "radial-gradient(58% 48% at 24% 80%,rgba(217,178,95,.04),transparent 56%)",
      "repeating-linear-gradient(128deg,rgba(236,234,230,.02) 0 1px,transparent 1px 8px)",
    ].join(","),
  },
  /**
   * The one card allowed to be loud.
   *
   * Orange is the tightest slot in this palette, squeezed between Gilt's
   * bronze and Oxblood's red, so it does not separate on hue: it separates on
   * chroma. Letting the drawn stock be the most saturated object in the set is
   * the argument rather than a compromise, because drawn things are more
   * saturated than photographed ones and that is exactly what this reads to.
   *
   * The ground is the only one here that sweeps temperature as well as value,
   * from a cool plum black into hot orange, which is what keeps it clear of
   * Gilt at a glance. The second bloom is gold rather than the beam blue every
   * other stock uses, because a cool highlight on this ground goes muddy.
   */
  /**
   * Two stocks carved out of Cel, on the evidence that carved the last four.
   *
   * Cel held `ink`, `shounen` and `adultanimation` — 24.2% of the catalogue,
   * wider than Neon Rain was when its width was judged a defect. The hues
   * were chosen off the gaps in the set rather than by feel: everything
   * printed here already sits between 24° and 44° (Cel, Gilt, Vellum), 137°
   * (Marble), 209° (Neon Rain), 266° (Nebula) and 315–344° (Bromide,
   * Oxblood), which leaves yellow-green and cyan unclaimed.
   *
   * Both are named for a printing process, the way Vellum, Bromide, Gilt and
   * Cel are, and both carry their process as the texture rather than as a
   * louder ground: the dot and the misregistration are the identity, the hue
   * only keeps them off each other.
   */
  {
    name: "Screentone",
    material: "linear-gradient(150deg,#101a1e,#1f4a52)",
    condition:
      "Your films keep returning to the tournament and the next rung above it: shounen, manga adaptations, power that escalates.",
    texture: [
      "radial-gradient(rgba(236,234,230,.045) 22%,transparent 23%) 0 0/6px 6px",
      "radial-gradient(rgba(236,234,230,.028) 22%,transparent 23%) 3px 3px/6px 6px",
      "radial-gradient(84% 62% at 78% 18%,rgba(236,234,230,.03),transparent 62%)",
    ].join(","),
  },
  {
    name: "Riso",
    material: "linear-gradient(150deg,#141709,#3d4a12)",
    condition:
      "Your films keep returning to the joke with something under it: adult animation, animated satire, the cartoon that is not for children.",
    texture: [
      "repeating-linear-gradient(94deg,rgba(236,234,230,.03) 0 1px,transparent 1px 4px)",
      "repeating-linear-gradient(86deg,rgba(217,178,95,.022) 0 1px,transparent 1px 5px)",
      "radial-gradient(74% 58% at 22% 78%,rgba(236,234,230,.035),transparent 60%)",
    ].join(","),
  },
  {
    name: "Cel",
    material: "linear-gradient(150deg,#171016,#7c3a12)",
    condition:
      "Your films keep returning to what was drawn rather than filmed: animation, talking animals, toys.",
    texture: [
      "radial-gradient(70% 54% at 26% 22%,rgba(236,234,230,.05),transparent 60%)",
      "radial-gradient(60% 50% at 78% 80%,rgba(217,178,95,.055),transparent 56%)",
      "repeating-linear-gradient(46deg,rgba(236,234,230,.022) 0 1px,transparent 1px 9px)",
    ].join(","),
  },
  {
    name: "Nebula",
    material: "linear-gradient(150deg,#231e36,#3b3054)",
    condition:
      "Your films keep returning to what could not happen: deep space, machines that think, time doubling back, myth.",
    texture:
      "radial-gradient(70% 55% at 72% 26%,rgba(169,154,217,.045),transparent 62%),radial-gradient(60% 50% at 24% 74%,rgba(143,174,204,.03),transparent 58%)",
  },
  {
    name: "Bare",
    material: "#1c1c21",
    condition:
      "No theme has emerged yet. The stock a card is printed on before its library has said anything.",
    texture: null,
  },
];

/**
 * The stock a finish name refers to, or undefined before anything is rated —
 * `computeVariant` returns an empty name in that case, and a card with no
 * stock yet falls back to plain ground rather than guessing at one.
 */
export function stockDef(name: string): StockDef | undefined {
  return STOCK_DEFS.find((s) => s.name === name);
}

export type AxisDef = { name: string; color: string; condition: string };

/**
 * The accents, as tints rather than colours.
 *
 * These were full-strength hues, which made the decade a third independent
 * colour on a card that already carries the tier's metal and the stock's
 * ground. Three uncorrelated hues over six tiers, ten stocks and four accents
 * is 240 combinations with nothing checking that any of them agree, and the
 * dice came up badly often: twelve tier-and-stock pairs alone sat more than
 * 130 degrees apart.
 *
 * Held at roughly 85% lightness and a sixth of the chroma, an accent still
 * reads as its own temperature against a dark ground while being unable to
 * fight anything. The axis keeps its four names and its meaning; it stops
 * being a hue that has to be reconciled with two others.
 */
export const ACCENT_DEFS: AxisDef[] = [
  { name: "Crimson", color: "#e8cfc8", condition: "That decade is the 1960s or earlier." },
  {
    name: "Cobalt",
    color: "#cfdae8",
    condition:
      "That decade is the 1970s, 1980s or 1990s. Also the accent before any decade leads.",
  },
  { name: "Emerald", color: "#cfe3d8", condition: "That decade is the 2000s or 2010s." },
  { name: "Amethyst", color: "#ddd2ea", condition: "That decade is the 2020s or later." },
];

/** The one place an accent's colour is written down, so the card and the binder cannot disagree. */
export const accentColorOf = (name: string): string =>
  ACCENT_DEFS.find((a) => a.name === name)?.color ?? "#cfdae8";

// Cut on the real spread of how people rate. The old bands asked 9.0 for
// Analog, which nobody reaches, and doubled it up as the value for a library
// with nothing in it yet.
export const AURA_DEFS: AxisDef[] = [
  { name: "Noir", color: "#6a6a72", condition: "Your average rating sits below 6.2." },
  { name: "Dream", color: "#8faecc", condition: "Your average sits from 6.2 to 7.1." },
  { name: "Cosmic", color: "#a98fd6", condition: "Your average sits from 7.2 to 8.1." },
  { name: "Analog", color: "#d9b25f", condition: "Your average reaches 8.2." },
];
