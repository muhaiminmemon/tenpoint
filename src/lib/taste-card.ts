import type { TasteSignals } from "./taste-card-signals";

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
  1990: "Indie",
  2000: "Millennial",
  2010: "Midnight",
  2020: "Modern",
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

export const ARCHETYPE_BY_GENRE: Record<string, string> = {
  Drama: "Formalist",
  Comedy: "Populist",
  Horror: "Nightcrawler",
  Action: "Maximalist",
  Thriller: "Strategist",
  Romance: "Romantic",
  Documentary: "Realist",
  Animation: "Dreamer",
  "Science Fiction": "Futurist",
  Fantasy: "Mythmaker",
  Crime: "Noirist",
  Adventure: "Wanderer",
  Mystery: "Detective",
  War: "Chronicler",
  Music: "Composer",
  Family: "Sentimentalist",
  History: "Historian",
  Western: "Outlander",
};

/**
 * What the title actually reflects, in one sentence.
 *
 * "The Midnight Maximalist" is a good name and a bad explanation: nothing in
 * it says that Midnight means the 2010s and Maximalist means action. This is
 * the line that says so.
 *
 * It replaces a set of mood quotes ("Prefers the film that trusts a long
 * silence"). Those read as character writing about the person rather than a
 * reading of their library, and a reader who wanted to know why they had been
 * called something got a second riddle instead of an answer. Both halves of
 * the title come from one countable fact each, so both are stated plainly.
 */
export function archetypeMeaning(
  topDecade: number | null,
  topGenre: string | undefined,
): string {
  const decade = topDecade === null ? null : `the ${topDecade}s`;
  if (decade && topGenre) {
    return `You rate more films from ${decade} than any other decade, and ${topGenre} leads them.`;
  }
  if (topGenre) return `${topGenre} leads your rated films. No decade leads yet.`;
  if (decade) return `You rate more films from ${decade} than any other decade. No genre leads yet.`;
  return "Nothing leads yet: no decade or genre is ahead of the others.";
}

export function tasteArchetype(
  topDecade: { decade: number } | null,
  topGenre: { name: string } | undefined,
): string {
  const era = topDecade ? (ERA_BY_DECADE[topDecade.decade] ?? "Eclectic") : "Eclectic";
  const noun = topGenre ? (ARCHETYPE_BY_GENRE[topGenre.name] ?? "Cinephile") : "Cinephile";
  return `The ${era} ${noun}`;
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

export function computeVariant(
  topGenre: string | undefined,
  topRatedDecade: number | null,
  topDecade: number | null,
  mean: number | null,
): Variant {
  const stock = (topGenre && GENRE_STOCK[topGenre]) || "Bare";

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

  let aura: string;
  if (mean === null) aura = "Analog";
  else if (mean < 65) aura = "Noir";
  else if (mean < 80) aura = "Dream";
  else if (mean < 90) aura = "Cosmic";
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

export const TRAIT_DEFS: TraitDef[] = [
  { key: "century", name: "Double Century", cond: "200 films logged", check: (s) => s.rated >= 200 },
  {
    key: "omnivore",
    name: "Genre Omnivore",
    cond: "15 distinct genres",
    check: (s) => s.distinctGenres >= 15,
  },
  {
    key: "wanderer",
    name: "Decade Wanderer",
    cond: "6 distinct decades",
    check: (s) => s.distinctDecades >= 6,
  },
  {
    key: "oldguard",
    name: "Old Guard",
    cond: "10 films before 1970",
    check: (s) => s.preSeventyCount >= 10,
  },
  {
    key: "silent",
    name: "Silent Era Pilgrim",
    cond: "3 films before 1950",
    check: (s) => s.preFiftyCount >= 3,
  },
  {
    key: "newrelease",
    name: "New Release Chaser",
    cond: "10 films from this year",
    check: (s) => s.currentYearReleaseCount >= 10,
  },
  {
    key: "director",
    name: "Director's Cut",
    cond: "5 films by one director",
    check: (s) => s.maxDirectorCount >= 5,
  },
  {
    key: "marathon",
    name: "Marathon Runner",
    cond: "10 films over 150 minutes",
    check: (s) => s.longFilmCount >= 10,
  },
  {
    key: "quickcuts",
    name: "Quick Cuts",
    cond: "15 films under 85 minutes",
    check: (s) => s.shortFilmCount >= 15,
  },
  {
    key: "comfort",
    name: "Comfort Rewatcher",
    cond: "One film, five viewings",
    check: (s) => s.maxSameFilmEntries >= 5,
  },
  {
    key: "rewatchdevotee",
    name: "Rewatch Devotee",
    cond: "10 rewatches logged",
    check: (s) => s.rewatchEntryCount >= 10,
  },
  {
    key: "reviewer",
    name: "Reviewer's Voice",
    cond: "25 reviews written",
    check: (s) => s.reviewCount >= 25,
  },
  { key: "perfect", name: "Perfect Ten", cond: "5 films rated 10.0", check: (s) => s.perfectTenCount >= 5 },
  {
    key: "toughcritic",
    name: "Tough Critic",
    cond: "5 films rated 3.0 or under",
    check: (s) => s.toughCriticCount >= 5,
  },
  {
    key: "steady",
    name: "Steady Hand",
    cond: "20+ ratings, tight spread",
    check: (s) => s.rated >= 20 && s.ratingStdDev !== null && s.ratingStdDev < 10,
  },
  {
    key: "wide",
    name: "Wide Spectrum",
    cond: "20+ ratings, wide spread",
    check: (s) => s.rated >= 20 && s.ratingStdDev !== null && s.ratingStdDev > 22,
  },
  {
    key: "sameyear",
    name: "Same-Year Watcher",
    cond: "5 films watched on release year",
    check: (s) => s.sameYearWatchCount >= 5,
  },
  {
    key: "arthouse",
    name: "Arthouse Purist",
    cond: "20 films known to be outside the mainstream",
    // Counted against films whose vote data is on file, not every rated film.
    // The old form subtracted from `rated`, so a library with no metadata
    // hydrated yet held this trait automatically.
    check: (s) => s.voteKnownCount - s.mainstreamCount >= 20,
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
    condition: "Drama, romance, family or music leads your rated films.",
    texture: "repeating-linear-gradient(102deg,rgba(236,234,230,.014) 0 1px,transparent 1px 6px)",
  },
  {
    name: "Neon Rain",
    material: "linear-gradient(150deg,#111820,#1d2c3c)",
    condition: "Horror, thriller, mystery or crime leads your rated films.",
    texture: "repeating-linear-gradient(74deg,rgba(143,174,204,.02) 0 1px,transparent 1px 10px)",
  },
  {
    name: "Filmstrip",
    material: "linear-gradient(150deg,#1a1a1f,#26262d)",
    condition: "Action, adventure or war leads your rated films.",
    texture:
      "repeating-linear-gradient(0deg,rgba(236,234,230,.02) 0 1px,transparent 1px 9px)",
  },
  {
    name: "Marble",
    material: "linear-gradient(150deg,#23232a,#3a3a43)",
    condition: "Documentary or history leads your rated films.",
    texture:
      "radial-gradient(120% 80% at 20% 15%,rgba(236,234,230,.022),transparent 60%),radial-gradient(90% 70% at 80% 85%,rgba(236,234,230,.015),transparent 55%)",
  },
  {
    name: "Nebula",
    material: "linear-gradient(150deg,#231e36,#3b3054)",
    condition: "Science fiction, fantasy or animation leads your rated films.",
    texture:
      "radial-gradient(70% 55% at 72% 26%,rgba(169,154,217,.045),transparent 62%),radial-gradient(60% 50% at 24% 74%,rgba(143,174,204,.03),transparent 58%)",
  },
  {
    name: "Bare",
    material: "#1c1c21",
    condition: "No genre leads yet. The stock before a leading genre exists.",
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

export const AURA_DEFS: AxisDef[] = [
  { name: "Noir", color: "#6a6a72", condition: "Your average rating sits below 6.5." },
  { name: "Dream", color: "#8faecc", condition: "Your average sits from 6.5 to 7.9." },
  { name: "Cosmic", color: "#a98fd6", condition: "Your average sits from 8.0 to 8.9." },
  {
    name: "Analog",
    color: "#d9b25f",
    condition: "Your average reaches 9.0, and the aura before anything is rated.",
  },
];
