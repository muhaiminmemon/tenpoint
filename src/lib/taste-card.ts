import type { TasteSignals } from "./taste-card-signals";
import { CLUSTERS, CLUSTER_PREVALENCE, STOCK_BY_CLUSTER } from "./archetype-clusters";

// ---------------------------------------------------------------------------
// LAYER 1 — LEVEL: films watched, mostly. Ticks up forever, no ceiling. Lives
// in taste.ts (buildHomeTasteCard) since it's a trivial function of `rated`.

// ---------------------------------------------------------------------------
// LAYER 2 — RARITY: a six-tier ladder purely on films rated. Never grinded by
// one path alone — see `nextTierMilestones` below for the "any three of five"
// progress shown toward the next tier.

export type RarityTier = {
  name: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic";
  index: number;
  floor: number;
  range: string;
  effect: string;
  border: string;
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
    range: "1–24 films",
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
    floor: 25,
    range: "25–74",
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
    floor: 75,
    range: "75–149",
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
    floor: 150,
    range: "150–299",
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
    floor: 300,
    range: "300–499",
    effect: "Gold foil, warm glow.",
    border: "conic-gradient(from 210deg,#4a3f24,#d9b25f,#3a3a44,#d9b25f,#4a3f24)",
    glow: "0 0 26px rgba(217,178,95,.25)",
    labelColor: "#d9b25f",
    swatch: "linear-gradient(120deg,#3a2f16,#d9b25f)",
    sheenOp: 0.55,
    sweepSec: 42,
  },
  {
    name: "Mythic",
    index: 5,
    floor: 500,
    range: "500+ films",
    effect: "Full foil, drifting light, particles.",
    border: "conic-gradient(from 0deg,#8faecc,#d9b25f,#c4756a,#8faecc)",
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

  return [
    { label: `${t.films} films logged`, detail: `${s.rated} / ${t.films}`, met: s.rated >= t.films },
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
  | { kind: "films"; filmsToNext: number };

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

export function tierStanding(rated: number, signals: TasteSignals): TierStanding {
  let byCount = RARITY_TIERS[0];
  for (const t of RARITY_TIERS) {
    if (rated >= t.floor) byCount = t;
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
      ? // The lift is spent. Only films move the floor now, and once it moves
        // the conditions for the rung after this one come back into play.
        { kind: "films", filmsToNext: Math.max(0, tier.floor - rated) }
      : { kind: "milestones", milestones: step, met, needed: MILESTONES_TO_PROMOTE },
  };
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
  return tierStanding(rated, signals).tier;
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
  oldShare: { typical: 0.1, spread: 0.12 },
  wideShare: { typical: 0.8, spread: 0.15 },
  mean: { typical: 70, spread: 12 },
  spreadOfRatings: { typical: 13, spread: 5.5 },
  topGenreShare: { typical: 0.45, spread: 0.12 },
  subtitleShare: { typical: 0.1, spread: 0.14 },
  rewatchShare: { typical: 0.1, spread: 0.1 },
  oneDirector: { typical: 1.25, spread: 0.55 },
  criticGap: { typical: 0.15, spread: 0.12 },
  // The opinion axes. Each is a difference between two averages in tenths, so
  // zero is "rates both kinds the same" and the spread is roughly how far
  // apart a person has to hold them before it is a preference rather than
  // noise: six tenths of a point.
  obscureLift: { typical: 0, spread: 6 },
  oldLift: { typical: 0, spread: 6 },
  foreignLift: { typical: 0, spread: 6 },
  oneFace: { typical: 1.25, spread: 0.55 },
  languages: { typical: 4, spread: 2.5 },
  crowdBias: { typical: -2, spread: 10 },
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
      ["Archival", `${pct(old)}% of your films were made before 1990.`],
      ["Recent", `${pct(1 - old)}% of your films were made after 1990.`],
    );
  }

  if (s.voteKnownCount >= 15) {
    const wide = s.mainstreamCount / s.voteKnownCount;
    axis(
      wide,
      ANCHOR.wideShare,
      ["Blockbuster", `${pct(wide)}% of your films have been rated by thousands of people.`],
      ["Underground", `${pct(1 - wide)}% of your films have fewer than 2,000 ratings anywhere.`],
    );
  }

  if (s.rated >= 10 && s.mean !== null) {
    const avg = (s.mean / 10).toFixed(1);
    axis(
      s.mean,
      ANCHOR.mean,
      ["Generous", `Your average rating is ${avg}.`],
      ["Hard-Marker", `Your average rating is ${avg}.`],
    );
  }

  if (s.rated >= 10 && s.ratingStdDev !== null) {
    axis(
      s.ratingStdDev,
      ANCHOR.spreadOfRatings,
      ["All-Or-Nothing", "Your ratings swing hard in both directions."],
      ["Even-Handed", "Your ratings cluster close together."],
    );
  }

  if (s.genreTaggedCount >= 15 && topGenre) {
    const share = s.topGenreCount / s.genreTaggedCount;
    axis(
      share,
      ANCHOR.topGenreShare,
      ["Single-Minded", `${pct(share)}% of your rated films carry ${topGenre}.`],
      ["Wide-Ranging", `You spread across ${s.distinctGenres} genres with no single one dominating.`],
    );
  }

  if (s.languageKnownCount >= 15) {
    const sub = s.nonEnglishCount / s.languageKnownCount;
    axis(
      sub,
      ANCHOR.subtitleShare,
      ["Subtitled", `${pct(sub)}% of your films were not made in English.`],
      null,
    );
  }

  if (s.totalEntryCount >= 20) {
    const again = s.rewatchEntryCount / s.totalEntryCount;
    axis(
      again,
      ANCHOR.rewatchShare,
      ["Rewatcher", `${pct(again)}% of your viewings are rewatches.`],
      ["One-Watch", "You almost never watch the same film twice."],
    );
  }

  if (s.directorKnownCount >= 15) {
    axis(
      s.topDirectorLift,
      ANCHOR.oneDirector,
      [
        "Director-Loyal",
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
        "Cast-Loyal",
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
      ["Multilingual", `You have rated films in ${s.distinctLanguages} different languages.`],
      null,
    );
  }

  if (s.imdbKnownCount >= 15) {
    const gap = s.imdbGapCount / s.imdbKnownCount;
    axis(
      gap,
      ANCHOR.criticGap,
      ["Contrarian", `${pct(gap)}% of your ratings sit far from the IMDb crowd.`],
      ["Consensus", `${pct(1 - gap)}% of your ratings land close to the IMDb crowd.`],
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
        "Deep-Cut",
        `You rate the least-known films in your library ${tenths(lift)} higher than the famous ones.`,
      ],
      [
        "Crowd-Pleased",
        `You rate the famous films in your library ${tenths(lift)} higher than the obscure ones.`,
      ],
    );
  }

  if (s.meanOld !== null && s.meanNew !== null) {
    const lift = s.meanOld - s.meanNew;
    axis(
      lift,
      ANCHOR.oldLift,
      ["Nostalgist", `You rate films made before 1990 ${tenths(lift)} higher than newer ones.`],
      ["Modernist", `You rate films made since 1990 ${tenths(lift)} higher than older ones.`],
    );
  }

  if (s.meanForeign !== null && s.meanEnglish !== null) {
    const lift = s.meanForeign - s.meanEnglish;
    axis(
      lift,
      ANCHOR.foreignLift,
      ["Worldly", `You rate films made outside English ${tenths(lift)} higher than English ones.`],
      null,
    );
  }

  if (s.imdbBias !== null) {
    axis(
      s.imdbBias,
      ANCHOR.crowdBias,
      ["Believer", `You rate ${tenths(s.imdbBias)} above the IMDb score on average.`],
      ["Skeptic", `You rate ${tenths(s.imdbBias)} below the IMDb score on average.`],
    );
  }

  if (s.rated >= 20) {
    const tens = s.perfectTenCount / s.rated;
    axis(
      tens,
      ANCHOR.perfectShare,
      ["Perfect-Ten", `${pct(tens)}% of your ratings are a flat 10.0.`],
      null,
    );

    const decimals = s.decimalRatingCount / s.rated;
    axis(
      decimals,
      ANCHOR.decimalShare,
      ["Precisionist", `${pct(decimals)}% of your ratings use the decimal.`],
      ["Round-Number", `${pct(1 - decimals)}% of your ratings are round numbers.`],
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

  return CLUSTERS.map((c) => {
    const count = s.clusters[c.key] ?? 0;
    const expected = total * (CLUSTER_PREVALENCE[c.key] ?? 0.05);
    return { cluster: c, count, lift: (count + PRIOR) / (expected + PRIOR) };
  })
    .filter((r) => r.count >= floor)
    .sort((a, b) => b.lift - a.lift || b.count - a.count);
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
};

export function themeReadings(s: TasteSignals, take = 5): ThemeReading[] {
  const total = s.clusterFilmCount;
  if (total <= 0) return [];
  // Distinctiveness decides which themes make the list; share decides the
  // order they are printed in. Ranking by one and printing the other gave
  // 11%, 14%, 24% down a row, which reads as broken however true it is.
  return signatureClusters(s)
    .slice(0, take)
    .map((r) => ({
      key: r.cluster.key,
      name: r.cluster.name.replace(/^The /, ""),
      note: r.cluster.note,
      count: r.count,
      pct: Math.round((r.count / total) * 100),
    }))
    .sort((a, b) => b.pct - a.pct);
}

export function themeDNA(s: TasteSignals, take = 5): { name: string; pct: number }[] {
  return themeReadings(s, take).map(({ name, pct }) => ({ name, pct }));
}

export function readArchetype(
  topGenre: string | undefined,
  topGenres: { name: string; count: number }[],
  s: TasteSignals,
): ArchetypeRead {
  const themes = signatureClusters(s);
  const best = readings(s, topGenre).sort((a, b) => b.score - a.score)[0];
  const modifier = best?.word ?? "Unwritten";
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
     * real: this is how many more films of that theme would have overtaken the
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
          ? `${needed} more ${needed === 1 ? "film" : "films"} about ${next.cluster.note} and you would be ${next.cluster.name}.`
          : `Closest behind: ${next.cluster.name}.`;
    }

    const nounMeaning =
      `${top.count} of your films are about ${top.cluster.note}` +
      ` \u2014 ${times}\u00d7 what a shelf your size usually holds, and ${share}% of yours.`;

    return {
      title: `${top.cluster.name.replace(/^The /, `The ${modifier} `)}`,
      modifier,
      modifierMeaning,
      noun: top.cluster.name.replace(/^The /, ""),
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
    title: `The ${modifier} ${noun}`,
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
  cond: string;
  check: (s: TasteSignals) => boolean;
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
export const TRAIT_DEFS: TraitDef[] = [
  // Two eras that do not contain each other. Read as "before 1970" and
  // "before 1950" they were one bracket inside the other, so holding the
  // harder one and not the easier one looked like a bug.
  {
    key: "silent",
    name: "Early Cinema",
    cond: "Three films made before 1950",
    check: (s) => s.preFiftyCount >= 3,
  },
  {
    key: "oldguard",
    name: "Old Guard",
    cond: "Ten films from the 1950s and 60s",
    check: (s) => s.midCenturyCount >= 10,
  },
  {
    key: "sameyear",
    name: "Opening Week",
    cond: "Five films watched the same year they came out",
    check: (s) => s.sameYearWatchCount >= 5,
  },
  {
    key: "director",
    name: "One Director",
    cond: "Five films by the same director",
    check: (s) => s.maxDirectorCount >= 5,
  },
  {
    key: "marathon",
    name: "Marathon Runner",
    cond: "Ten films over two and a half hours",
    check: (s) => s.longFilmCount >= 10,
  },
  {
    key: "quickcuts",
    name: "Quick Cuts",
    cond: "Fifteen films under 85 minutes",
    check: (s) => s.shortFilmCount >= 15,
  },
  {
    key: "comfort",
    name: "Comfort Rewatcher",
    cond: "One film watched five times",
    check: (s) => s.maxSameFilmEntries >= 5,
  },
  {
    key: "perfect",
    name: "Perfect Ten",
    cond: "Five films rated 10.0",
    check: (s) => s.perfectTenCount >= 5,
  },
  {
    key: "toughcritic",
    name: "Tough Critic",
    cond: "Five films rated 3.0 or lower",
    check: (s) => s.toughCriticCount >= 5,
  },
  {
    key: "steady",
    name: "Steady Hand",
    cond: "Twenty ratings that mostly land close together",
    check: (s) => s.rated >= 20 && s.ratingStdDev !== null && s.ratingStdDev < 10,
  },
  {
    key: "wide",
    name: "Wide Spectrum",
    cond: "Twenty ratings that run the full scale",
    check: (s) => s.rated >= 20 && s.ratingStdDev !== null && s.ratingStdDev > 22,
  },
  {
    key: "arthouse",
    name: "Off the Beaten Path",
    cond: "Twenty films that never found a wide audience",
    // Counted against films whose vote data is on file, not every rated film.
    // The old form subtracted from `rated`, so a library with no metadata
    // hydrated yet held this trait automatically.
    check: (s) => s.voteKnownCount - s.mainstreamCount >= 20,
  },
  {
    key: "precise",
    name: "Precisionist",
    cond: "Fifty ratings that use the decimal, not a round number",
    check: (s) => s.decimalRatingCount >= 50,
  },
  {
    key: "subtitles",
    name: "Reads the Subtitles",
    cond: "Twenty films not made in English",
    check: (s) => s.nonEnglishCount >= 20,
  },
  {
    key: "worldtour",
    name: "World Tour",
    cond: "Films in five different languages",
    check: (s) => s.distinctLanguages >= 5,
  },
  {
    key: "regularface",
    name: "Regular Face",
    cond: "Five films with the same actor in them",
    check: (s) => s.maxCastCount >= 5,
  },
  {
    key: "deepcut",
    name: "Deep Cut",
    cond: "Fifty films in a single genre",
    check: (s) => s.topGenreCount >= 50,
  },
  {
    key: "criticsagree",
    name: "Critics Agree",
    cond: "Ten films you rated 8.0 or higher that critics scored 90 or higher",
    check: (s) => s.criticsAgreeCount >= 10,
  },
  {
    key: "againstgrain",
    name: "Against the Grain",
    cond: "Five films you rated 8.0 or higher that critics scored under 50",
    check: (s) => s.againstGrainCount >= 5,
  },
  {
    key: "secondopinion",
    name: "Second Opinion",
    cond: "Ten films you rated three points away from the IMDb crowd",
    check: (s) => s.imdbGapCount >= 10,
  },
];

export type Trait = { key: string; name: string; cond: string; held: boolean };

// No "X% of filmgoers hold this" here — with a young, small user base that
// number is either a meaningless 25%/50% or missing outright, not a genuine
// rarity signal. The condition text is the reward; whether you've met it is
// the only other thing worth showing.
export function evaluateTraits(s: TasteSignals): Trait[] {
  return TRAIT_DEFS.map((t) => ({
    key: t.key,
    name: t.name,
    cond: t.cond,
    held: t.check(s),
  }));
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
