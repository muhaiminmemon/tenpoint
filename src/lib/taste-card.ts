import type { TasteSignals } from "./taste-card-signals";
import { CLUSTERS, CLUSTER_PREVALENCE, STOCK_BY_CLUSTER } from "./archetype-clusters";

// ---------------------------------------------------------------------------
// LAYER 1 — LEVEL: films watched, mostly. Ticks up forever, no ceiling. Lives
// in taste.ts (buildHomeTasteCard) since it's a trivial function of `rated`.

// ---------------------------------------------------------------------------
// LAYER 2 — RARITY: a six-tier ladder on what has been watched. Never grinded by
// one path alone — see `nextTierMilestones` below for the "any three of five"
// progress shown toward the next tier.

export type RarityTier = {
  name: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic";
  index: number;
  /** films alone that reach this rung */
  floor: number;
  /** seasons alone that reach it, roughly a quarter of the film count */
  seasonFloor: number;
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
    floor: 1,
    seasonFloor: 1,
    range: "Your first film or season",
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
    floor: 40,
    seasonFloor: 10,
    range: "40 films or 10 seasons",
    effect: "A cleaner edge, faint sheen.",
    border: "#34343d",
    glow: "none",
    labelColor: "#9fb0c0",
    swatch: "linear-gradient(120deg,#232329,#30303a)",
    sheenOp: 0.12,
    sweepSec: 0,
  },
  {
    name: "Rare",
    index: 2,
    floor: 120,
    seasonFloor: 30,
    range: "120 films or 30 seasons",
    effect: "Beam-blue border.",
    border: "linear-gradient(160deg,#34506a,#8faecc)",
    glow: "none",
    labelColor: "#8faecc",
    swatch: "linear-gradient(120deg,#1a2530,#34506a)",
    sheenOp: 0.2,
    sweepSec: 0,
  },
  {
    name: "Epic",
    index: 3,
    floor: 300,
    seasonFloor: 75,
    range: "300 films or 75 seasons",
    effect: "Silver foil, quiet shimmer.",
    border: "linear-gradient(160deg,#5a5570,#b3a3d6)",
    glow: "none",
    labelColor: "#b3a3d6",
    swatch: "linear-gradient(120deg,#2a2740,#b3a3d6)",
    sheenOp: 0.42,
    sweepSec: 52,
  },
  {
    name: "Legendary",
    index: 4,
    floor: 700,
    seasonFloor: 175,
    range: "700 films or 175 seasons",
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
    floor: 1400,
    seasonFloor: 350,
    range: "1,400 films or 350 seasons",
    effect: "Full foil, drifting light, particles.",
    border: "conic-gradient(from 0deg,#8faecc,#d9b25f,#c4756a,#8faecc)",
    borderFlat: "linear-gradient(130deg,#8faecc,#d9b25f 34%,#c4756a 66%,#8faecc)",
    glow: "0 0 34px rgba(143,174,204,.28)",
    labelColor: "#eceae6",
    swatch: "conic-gradient(from 0deg,#8faecc,#d9b25f,#c4756a,#8faecc)",
    sheenOp: 0.7,
    sweepSec: 34,
  },
];

// ---------------------------------------------------------------------------
// LAYER 2b — MILESTONES: five real signals. Meeting three genuinely promotes,
// on top of the film-count floor, so breadth is a real second route up the
// ladder rather than a progress bar that decided nothing.

export type Milestone = { label: string; detail: string; met: boolean };

type MilestoneTargets = {
  films: number;
  genres: number;
  decades: number;
  reviews: number;
  rewatches: number;
};

// Every target here is a fact about the films themselves (count, breadth,
// curation) rather than time elapsed in the app — a bulk Letterboxd import
// should land exactly where the same taste, logged natively, would.
// Favourites used to be the fifth condition and was removed: the only control
// that sets one lives inside the library's shelf view, so a tier could be
// gated on an action most people never find. A milestone nobody can reach is
// not a target, it is a wall.
const MILESTONE_TARGETS: MilestoneTargets[] = [
  { films: 25, genres: 5, decades: 2, reviews: 3, rewatches: 2 },
  { films: 75, genres: 8, decades: 3, reviews: 8, rewatches: 5 },
  { films: 150, genres: 11, decades: 4, reviews: 15, rewatches: 10 },
  { films: 300, genres: 15, decades: 5, reviews: 25, rewatches: 20 },
  { films: 500, genres: 17, decades: 6, reviews: 60, rewatches: 40 },
];

/**
 * The five conditions for one step up the ladder.
 *
 * Extracted so the gate and the progress display read the same list. They used
 * to be separate: the card printed "needs any three of five" while the tier was
 * decided by film count alone, so someone could meet three conditions, watch
 * the interface confirm it, and stay exactly where they were.
 */
export function milestonesAt(stepIndex: number, s: TasteSignals): Milestone[] {
  const t = MILESTONE_TARGETS[stepIndex];
  if (!t) return [];

  /**
   * Titles, counted the way the ladder counts them.
   *
   * `rated` is rows, and a series rated whole and by season puts both on the
   * shelf, so somebody who rated Breaking Bad and three of its seasons was
   * four films closer to a tier for one show. The ladder already resolves this
   * with `seasonsCredited`, which takes the greater of the two readings rather
   * than their sum, and this milestone now reads the same number instead of
   * disagreeing with the gate standing next to it.
   */
  const titles = s.rated - s.seasonCount - s.wholeShowCount + s.seasonsCredited;

  return [
    { label: `${t.films} titles logged`, detail: `${titles} / ${t.films}`, met: titles >= t.films },
    {
      label: `${t.genres} genres watched`,
      detail: `${s.distinctGenres} genres`,
      met: s.distinctGenres >= t.genres,
    },
    {
      label: `${t.decades} decades explored`,
      detail: `${s.distinctDecades} decades`,
      met: s.distinctDecades >= t.decades,
    },
    {
      label: `${t.reviews} reviews written`,
      detail: `${s.reviewCount} reviews`,
      met: s.reviewCount >= t.reviews,
    },
    {
      label: `${t.rewatches} rewatches logged`,
      detail: `${s.rewatchEntryCount} / ${t.rewatches}`,
      met: s.rewatchEntryCount >= t.rewatches,
    },
  ];
}

/** Three of the five. The bar the card has always advertised. */
export const MILESTONES_TO_PROMOTE = 3;

/**
 * Everything about where someone stands on the ladder, from one function.
 *
 * The gate and the progress display used to be computed separately, and they
 * disagreed. Film count set a floor; meeting three of five conditions lifted
 * you one rung above it. But the card then drew the *next* rung's conditions,
 * which no number of met conditions could ever unlock, because the lift is
 * capped at one. People met three, watched the card confirm it, and stayed put.
 *
 * So both answers come from here. A tier is reached one of two ways and the
 * display always names the one that is actually in force:
 *
 * - **Standing on your count.** Three of five conditions lifts you a rung.
 * - **Already lifted.** The rung above needs the film count to catch up first;
 *   conditions cannot carry you twice.
 *
 * The cap is what stops breadth from running away with the whole ladder: the
 * top step's conditions are also satisfied at every step beneath it, so
 * uncapped chaining took a sixty-film library to Mythic, a tier that is meant
 * to mean five hundred.
 */
export type TierGate =
  | { kind: "milestones"; milestones: Milestone[]; met: number; needed: number }
  | {
      kind: "films";
      filmsToNext: number;
      seasonsToNext: number;
      /** what each half is worth toward the next rung, as whole percentages */
      filmPct: number;
      seasonPct: number;
      progressPct: number;
    };

export type TierStanding = {
  /** the tier in force */
  tier: RarityTier;
  /** what the film count alone earns */
  byCount: RarityTier;
  /** true when conditions lifted the tier above the count */
  promoted: boolean;
  /** null at the top of the ladder */
  next: RarityTier | null;
  /** how the next rung is actually reached from here; null at the top */
  gate: TierGate | null;
};

/**
 * How far along a rung somebody is, as a fraction of the two stated numbers.
 *
 * A rung is "300 films or 75 seasons", and either alone reaches it, so the two
 * are read as fractions and added: half the films plus half the seasons is a
 * whole rung. That is the only rule that does not punish somebody for watching
 * both, and it needs no multiplier to explain, which the previous version did.
 */
export function ladderProgress(films: number, seasons: number, tier: RarityTier): number {
  return films / Math.max(1, tier.floor) + seasons / Math.max(1, tier.seasonFloor);
}

export function tierStanding(films: number, seasons: number, signals: TasteSignals): TierStanding {
  let byCount = RARITY_TIERS[0];
  for (const t of RARITY_TIERS) {
    if (ladderProgress(films, seasons, t) >= 1) byCount = t;
  }

  const step = milestonesAt(byCount.index, signals);
  const met = step.filter((m) => m.met).length;
  const above = RARITY_TIERS[byCount.index + 1];

  const promoted = Boolean(above) && met >= MILESTONES_TO_PROMOTE;
  const tier = promoted ? above : byCount;
  const next = RARITY_TIERS[tier.index + 1] ?? null;

  if (!next) return { tier, byCount, promoted, next: null, gate: null };

  return {
    tier,
    byCount,
    promoted,
    next,
    gate: promoted
      ? // The lift is spent. Only watching moves the floor now, and once it
        // moves the conditions for the rung after this one come back into play.
        (() => {
          // Both halves are shown as their own share of the rung, because
          // "any mix" explains nothing: the two percentages add to the
          // progress, and a reader can check either against their own diary.
          const filmPct = Math.round((films / Math.max(1, tier.floor)) * 100);
          const seasonPct = Math.round((seasons / Math.max(1, tier.seasonFloor)) * 100);
          const left = Math.max(0, 1 - ladderProgress(films, seasons, tier));
          return {
            kind: "films" as const,
            filmsToNext: Math.ceil(left * tier.floor),
            seasonsToNext: Math.ceil(left * tier.seasonFloor),
            filmPct,
            seasonPct,
            progressPct: Math.min(100, filmPct + seasonPct),
          };
        })()
      : { kind: "milestones", milestones: step, met, needed: MILESTONES_TO_PROMOTE },
  };
}

/**
 * What one season is worth, measured against a film.
 *
 * Counting rows says this catalogue is 16% television. Counting hours says
 * 51%, because a season here runs fourteen episodes, which is 5.3 films of
 * watching. Neither is right for a card: rows under-count a habit that takes
 * most of somebody's viewing time, and hours would turn a film diary into a
 * television one.
 *
 * Four sits deliberately between the two, and it is the same ratio the ladder
 * states out loud: every rung is a film count and a season count roughly four
 * times smaller. Nothing here relies on a reader trusting a hidden multiplier.
 *
 * It is a weight and not a quota on purpose. A quota would give shows to
 * somebody who watches none and cap somebody who watches almost nothing else;
 * a weight is true for both of them and happens to land on 40/60 in the middle.
 */
export const SEASON_WEIGHT = 4;

/**
 * The size of a library in film-equivalents.
 *
 * The ladder no longer uses this: it states two real counts per rung instead,
 * which needs no constant to explain. This is still what decides how many of
 * the four signature slots a series can hold, and it is never applied to the
 * average, which has to stay the mean of the ratings to stay checkable.
 */
export function weightedSize(films: number, seasons: number): number {
  return films + seasons * SEASON_WEIGHT;
}

/** The tier in force. A thin read on `tierStanding` for callers that want only that. */
export function computeTier(rated: number, signals?: TasteSignals): RarityTier {
  if (!signals) {
    let tier = RARITY_TIERS[0];
    for (const t of RARITY_TIERS) {
      if (rated >= t.floor) tier = t;
    }
    return tier;
  }
  return tierStanding(rated, 0, signals).tier;
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
function signatureClusters(s: TasteSignals) {
  const total = s.clusterFilmCount;
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
    const count = s.clusters[c.key] ?? 0;
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
  const lead = ranked[0];
  if (lead) {
    const contenders = ranked.filter((r) => r.lift >= lead.lift * 0.9);
    const biggest = contenders.reduce((a, b) => (b.count > a.count ? b : a), lead);
    if (biggest !== lead) {
      return [biggest, ...ranked.filter((r) => r !== biggest)];
    }
  }
  return ranked;
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
  /** the name as it prints, without the article */
  name: string;
  /** what the theme actually is, in a reader's own words */
  note: string;
  count: number;
  pct: number;
  /** how many times more of it this library holds than an ordinary one */
  lift: number;
};

export function themeReadings(s: TasteSignals, take = 5): ThemeReading[] {
  const total = s.clusterFilmCount;
  if (total <= 0) return [];
  /**
   * Ordered by the multiple, and the multiple is what gets printed.
   *
   * These were ordered by distinctiveness and printed as share, which put the
   * theme that named the card *below* a bigger one and left the list looking
   * like it disagreed with the title. Whatever decides the order has to be the
   * number on the page.
   */
  return signatureClusters(s)
    .slice(0, take)
    .map((r) => ({
      key: r.cluster.key,
      name: r.cluster.name,
      note: r.cluster.note,
      count: r.count,
      pct: Math.round((r.count / total) * 100),
      lift: r.lift,
    }));
}

export function themeDNA(
  s: TasteSignals,
  take = 5,
): { name: string; pct: number; lift: number }[] {
  return themeReadings(s, take).map(({ name, pct, lift }) => ({ name, pct, lift }));
}

export function readArchetype(
  topGenre: string | undefined,
  topGenres: { name: string; count: number }[],
  s: TasteSignals,
): ArchetypeRead {
  const themes = signatureClusters(s);
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
    const times = top.lift.toFixed(1);

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

    const nounMeaning =
      `${top.count} of your titles are about ${top.cluster.note}` +
      `, ${times}\u00d7 what a shelf that size usually holds and ${share}% of the whole shelf.`;

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
  const theme = signatureClusters(signals)[0];
  const stock =
    (theme && STOCK_BY_CLUSTER[theme.cluster.key]) ||
    (topGenre && GENRE_STOCK[topGenre]) ||
    "Bare";

  const decade = topRatedDecade ?? topDecade;
  let accent: string;
  let accentColor: string;
  if (decade === null) {
    accent = "Cobalt";
    accentColor = "#8faecc";
  } else if (decade < 1970) {
    accent = "Crimson";
    accentColor = "#c4756a";
  } else if (decade < 2000) {
    accent = "Cobalt";
    accentColor = "#8faecc";
  } else if (decade < 2015) {
    accent = "Emerald";
    accentColor = "#7fb59a";
  } else {
    accent = "Amethyst";
    accentColor = "#a98fd6";
  }

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

  return { name: stock, stock, accent, aura, accentColor };
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
  /** the CSS ground this stock prints on */
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
  {
    name: "Filmstrip",
    material: "linear-gradient(150deg,#1a1a1f,#26262d)",
    condition:
      "Your films keep returning to motion: heists, revenge, blades, engines, the front line, the open road.",
    texture:
      "repeating-linear-gradient(0deg,rgba(236,234,230,.02) 0 1px,transparent 1px 9px)",
  },
  {
    name: "Marble",
    material: "linear-gradient(150deg,#23232a,#3a3a43)",
    condition:
      "Your films keep returning to the record and to remarks upon it: what happened, when it happened, and the joke somebody made about it.",
    texture:
      "radial-gradient(120% 80% at 20% 15%,rgba(236,234,230,.022),transparent 60%),radial-gradient(90% 70% at 80% 85%,rgba(236,234,230,.015),transparent 55%)",
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

export const ACCENT_DEFS: AxisDef[] = [
  { name: "Crimson", color: "#c4756a", condition: "That decade is the 1960s or earlier." },
  {
    name: "Cobalt",
    color: "#8faecc",
    condition:
      "That decade is the 1970s, 1980s or 1990s. Also the accent before any decade leads.",
  },
  { name: "Emerald", color: "#7fb59a", condition: "That decade is the 2000s or 2010s." },
  { name: "Amethyst", color: "#a98fd6", condition: "That decade is the 2020s or later." },
];

// Cut on the real spread of how people rate. The old bands asked 9.0 for
// Analog, which nobody reaches, and doubled it up as the value for a library
// with nothing in it yet.
export const AURA_DEFS: AxisDef[] = [
  { name: "Noir", color: "#6a6a72", condition: "Your average rating sits below 6.2." },
  { name: "Dream", color: "#8faecc", condition: "Your average sits from 6.2 to 7.1." },
  { name: "Cosmic", color: "#a98fd6", condition: "Your average sits from 7.2 to 8.1." },
  { name: "Analog", color: "#d9b25f", condition: "Your average reaches 8.2." },
];
