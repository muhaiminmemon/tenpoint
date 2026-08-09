import { CLUSTERS, KEYWORD_STOPLIST } from "./archetype-clusters";

/**
 * What kind of experience a work is, as strengths rather than memberships.
 *
 * The model this replaces asked one question per theme — does this title carry
 * a matching keyword, yes or no — and a single weak tag was enough to answer
 * yes. "Based on manga" made Monster and Frieren the same kind of thing as a
 * battle shounen; "investigation" made a domestic drama a procedural. Then the
 * title's affection was split evenly across everything it had matched, so a
 * work that is overwhelmingly one thing and incidentally another was recorded
 * as half of each.
 *
 * Here a title has a strength in every dimension, most of them zero, and the
 * strength comes from several kinds of evidence agreeing rather than from any
 * one of them firing.
 */

export const SEMANTIC_MODEL_VERSION = 1;

export type SemanticDimension =
  | "psychological"
  | "emotional"
  | "worldbuilding"
  | "atmospheric"
  | "mystery"
  | "crime"
  | "horror"
  | "wonder"
  | "adventure"
  | "romance"
  | "comedy"
  | "human"
  | "action"
  | "historical"
  | "social"
  | "comfort";

export const DIMENSIONS: SemanticDimension[] = [
  "psychological", "emotional", "worldbuilding", "atmospheric", "mystery",
  "crime", "horror", "wonder", "adventure", "romance", "comedy", "human",
  "action", "historical", "social", "comfort",
];

/**
 * Sixteen, and deliberately not the archetype's sixteen.
 *
 * `atmospheric` is new: it is the clearest thing the old model could not say at
 * all, because no keyword cluster describes how a film feels rather than what
 * happens in it. `experimental` is gone — it had no evidence source in the old
 * model either, and inventing one to fill a slot is how unreachable dimensions
 * are born.
 */
export const DIMENSION_LABELS: Record<SemanticDimension, string> = {
  psychological: "Psychological",
  emotional: "Emotional",
  worldbuilding: "Worldbuilding",
  atmospheric: "Atmospheric",
  mystery: "Mystery",
  crime: "Crime",
  horror: "Horror",
  wonder: "Wonder",
  adventure: "Adventure",
  romance: "Romance",
  comedy: "Comedy",
  human: "Human Drama",
  action: "Action",
  historical: "Historical",
  social: "Social / Political",
  comfort: "Comfort",
};

type Weights = Partial<Record<SemanticDimension, number>>;

/**
 * TMDB genres, the most reliable field in the catalogue at ~100% coverage.
 *
 * A genre is a strong signal about category and a weak one about experience, so
 * these top out around 0.6: a genre alone should never max a dimension, but it
 * should be most of the way there when nothing contradicts it.
 */
const GENRE_EVIDENCE: Record<string, Weights> = {
  Action: { action: 0.6, adventure: 0.25 },
  Adventure: { adventure: 0.6, wonder: 0.25 },
  Animation: { wonder: 0.35 },
  Comedy: { comedy: 0.5, comfort: 0.18 },
  Crime: { crime: 0.6, mystery: 0.25 },
  Documentary: { social: 0.5, human: 0.28, historical: 0.2 },
  Drama: { human: 0.42, emotional: 0.22 },
  Family: { comfort: 0.45, wonder: 0.22, emotional: 0.15 },
  Fantasy: { worldbuilding: 0.6, wonder: 0.45 },
  History: { historical: 0.65, human: 0.25 },
  Horror: { horror: 0.65, atmospheric: 0.35 },
  Music: { emotional: 0.4, human: 0.3 },
  Mystery: { mystery: 0.6, atmospheric: 0.3, psychological: 0.25 },
  Romance: { romance: 0.55, emotional: 0.3 },
  "Science Fiction": { worldbuilding: 0.6, wonder: 0.35 },
  "TV Movie": {},
  Thriller: { psychological: 0.35, atmospheric: 0.35, crime: 0.25 },
  War: { action: 0.35, historical: 0.35, human: 0.22, social: 0.3 },
  Western: { adventure: 0.45, historical: 0.4 },
  // television genres
  "Action & Adventure": { action: 0.55, adventure: 0.45 },
  "Sci-Fi & Fantasy": { worldbuilding: 0.6, wonder: 0.4 },
  Kids: { comfort: 0.55, wonder: 0.3 },
  Reality: { comfort: 0.3 },
  Soap: { romance: 0.4, emotional: 0.45 },
  Talk: { comfort: 0.3 },
  "War & Politics": { social: 0.55, historical: 0.35, action: 0.25 },
};

/**
 * The forty-nine curated clusters, kept as evidence rather than identity.
 *
 * This is the good part of the old model: somebody sat down and decided which
 * keywords mean "heist" and which mean "haunting", and that knowledge is worth
 * keeping. What changes is what a match produces. A cluster no longer *is* a
 * theme — it contributes toward several dimensions at different strengths, so
 * `gumshoe` can be mostly Mystery, partly Crime and a little Atmospheric rather
 * than a single box a title is in or out of.
 */
const CLUSTER_EVIDENCE: Record<string, Weights> = {
  heist: { crime: 0.7, action: 0.3, adventure: 0.2 },
  loop: { psychological: 0.6, worldbuilding: 0.4, mystery: 0.3 },
  slasher: { horror: 0.85, atmospheric: 0.4 },
  occult: { horror: 0.7, atmospheric: 0.5, worldbuilding: 0.3 },
  body: { horror: 0.75, psychological: 0.45, atmospheric: 0.35 },
  void: { worldbuilding: 0.75, wonder: 0.5, atmospheric: 0.3 },
  machine: { worldbuilding: 0.7, psychological: 0.4, social: 0.3 },
  dissident: { social: 0.85, worldbuilding: 0.3, psychological: 0.25 },
  apocalypse: { worldbuilding: 0.5, action: 0.4, atmospheric: 0.35 },
  revenge: { crime: 0.6, action: 0.45, emotional: 0.25 },
  comingofage: { emotional: 0.6, human: 0.5 },
  grief: { emotional: 0.8, psychological: 0.55, human: 0.5 },
  procedural: { crime: 0.65, mystery: 0.5 },
  gumshoe: { mystery: 0.7, crime: 0.5, atmospheric: 0.4 },
  whodunit: { mystery: 0.85, crime: 0.35 },
  missing: { mystery: 0.6, psychological: 0.4, atmospheric: 0.3 },
  identity: { psychological: 0.85, atmospheric: 0.4, mystery: 0.3 },
  court: { crime: 0.5, social: 0.5, human: 0.25 },
  blade: { action: 0.7, adventure: 0.35 },
  spy: { crime: 0.5, action: 0.4, mystery: 0.35 },
  prison: { crime: 0.5, human: 0.4, emotional: 0.3 },
  town: { human: 0.6, comfort: 0.3, emotional: 0.25 },
  road: { adventure: 0.6, human: 0.4 },
  sport: { human: 0.5, emotional: 0.4 },
  stage: { emotional: 0.6, human: 0.5 },
  deadpan: { comedy: 0.8, social: 0.2 },
  satire: { social: 0.8, comedy: 0.5 },
  noir: { crime: 0.8, atmospheric: 0.6, mystery: 0.35 },
  period: { historical: 0.85, human: 0.3 },
  truestory: { human: 0.5, historical: 0.4, social: 0.35 },
  war: { action: 0.5, historical: 0.5, human: 0.35, social: 0.3 },
  myth: { worldbuilding: 0.85, wonder: 0.55, adventure: 0.3 },
  hearth: { human: 0.6, emotional: 0.5, comfort: 0.25 },
  romance: { romance: 0.9, emotional: 0.55 },
  ink: { wonder: 0.5, comfort: 0.35 },
  caped: { action: 0.6, wonder: 0.5, adventure: 0.3 },
  creature: { wonder: 0.45, horror: 0.4, adventure: 0.35 },
  ghost: { horror: 0.7, atmospheric: 0.6, psychological: 0.3 },
  undead: { horror: 0.75, atmospheric: 0.45 },
  sea: { adventure: 0.7, wonder: 0.3 },
  flight: { adventure: 0.55, wonder: 0.3 },
  speed: { action: 0.7, adventure: 0.3 },
  outsider: { social: 0.8, human: 0.45, emotional: 0.3 },
  faith: { emotional: 0.5, human: 0.45, psychological: 0.3 },
  alien: { worldbuilding: 0.7, wonder: 0.5 },
  sitcom: { comedy: 0.8, comfort: 0.6 },
  shounen: { action: 0.7, adventure: 0.45, worldbuilding: 0.4 },
  adultanimation: { comedy: 0.7, social: 0.35 },
  winterholiday: { comfort: 0.8, emotional: 0.35 },
};

/**
 * Words in a synopsis, which is the one source that describes the story rather
 * than filing it.
 *
 * Overviews are on ~100% of the catalogue at a median of 255 characters, which
 * is enough for a handful of decisive words and not enough for anything
 * subtler. So these are deliberately few and deliberately weak: a synopsis
 * corroborates, it does not decide.
 */
const SYNOPSIS_EVIDENCE: [RegExp, Weights][] = [
  [/\b(murder|killer|homicide|detective|investigat\w+|crime|heist|robbery)\b/i, { crime: 0.4, mystery: 0.3 }],
  [/\b(haunt\w+|demon|possess\w+|curse[ds]?|nightmare|terror)\b/i, { horror: 0.45, atmospheric: 0.3 }],
  [/\b(memory|memories|dream\w*|identity|mind|sanity|obsess\w+|delusion)\b/i, { psychological: 0.4 }],
  [/\b(planet|galaxy|kingdom|empire|realm|magic|wizard|dragon|future|dystopia\w*)\b/i, { worldbuilding: 0.45, wonder: 0.25 }],
  [/\b(love|romance|marriage|affair|wedding|heartbreak)\b/i, { romance: 0.45, emotional: 0.3 }],
  [/\b(family|father|mother|son|daughter|brother|sister|grief|loss|dying)\b/i, { human: 0.4, emotional: 0.35 }],
  [/\b(war|soldier|battle|army|invasion|revolution)\b/i, { action: 0.3, historical: 0.3, social: 0.25 }],
  [/\b(comedy|comic|hilarious|funny|sitcom|parody|satir\w+)\b/i, { comedy: 0.45 }],
  [/\b(century|historical|18\d\d|19[0-4]\d|ancient|medieval|victorian)\b/i, { historical: 0.4 }],
  [/\b(class|poverty|racism|corruption|political|protest|inequality)\b/i, { social: 0.45 }],
  [/\b(journey|quest|voyage|adventure|expedition|treasure)\b/i, { adventure: 0.45 }],
  [/\b(fight\w*|chase|escape|survive|mission|assassin)\b/i, { action: 0.35 }],
];

/**
 * Broad keywords that are true of half the catalogue.
 *
 * These are not stoplisted — they carry a little meaning — but on their own
 * they are close to noise, and the old model let exactly these decide what a
 * title was. Their contribution is scaled down rather than removed.
 */
const WEAK_KEYWORDS = new Set([
  "based on manga", "based on novel or book", "based on comic", "anime",
  "cartoon", "investigation", "supernatural", "family", "friendship",
  "3d animation", "kids", "school", "woman director", "sequel", "parody",
]);
const WEAK_SCALE = 0.35;

export type SemanticEvidence = {
  genres: number;
  clusters: number;
  synopsis: number;
  /** which clusters matched, for debugging and for the binder */
  matched: string[];
};

export type SemanticProfile = {
  dimensions: Record<SemanticDimension, number>;
  confidence: number;
  evidence: SemanticEvidence;
  modelVersion: number;
};

export type SemanticInput = {
  genres: string[] | null;
  keywords: string[] | null;
  overview: string | null;
};

/**
 * Evidence combines by saturation, never by sum.
 *
 * Three sources each saying 0.6 should land near 0.94 rather than at 1.8
 * clamped to 1.0, because clamping loses the difference between "three sources
 * agree" and "one source shouted". This is the standard noisy-or: each piece of
 * evidence removes part of the remaining doubt.
 */
function combine(into: Record<string, number>, weights: Weights, scale = 1) {
  for (const [dim, w] of Object.entries(weights)) {
    const add = Math.max(0, Math.min(1, (w ?? 0) * scale));
    into[dim] = 1 - (1 - (into[dim] ?? 0)) * (1 - add);
  }
}

export function semanticProfile(input: SemanticInput): SemanticProfile {
  const genres = Array.isArray(input.genres) ? input.genres : [];
  const rawKeywords = Array.isArray(input.keywords) ? input.keywords : [];
  const overview = typeof input.overview === "string" ? input.overview : "";

  const keywords = rawKeywords
    .map((k) => k.toLowerCase())
    .filter((k) => !KEYWORD_STOPLIST.has(k));

  // ---- source 1: genres ---------------------------------------------------
  const fromGenres: Record<string, number> = {};
  for (const g of genres) combine(fromGenres, GENRE_EVIDENCE[g] ?? {});

  // ---- source 2: curated clusters, weighted by how much of one matched ----
  const fromClusters: Record<string, number> = {};
  const matched: string[] = [];
  const held = new Set(keywords);
  for (const cluster of CLUSTERS) {
    const hits = cluster.keywords.filter((k) => held.has(k));
    if (hits.length === 0) continue;
    matched.push(cluster.key);
    /**
     * How much of the cluster this title actually carries.
     *
     * One matching keyword out of a cluster's twenty is a hint; five is a
     * statement. The old model treated both as full membership, which is the
     * single change that stops "based on manga" from making a quiet drama a
     * battle shounen.
     */
    const strength = Math.min(1, 0.45 + 0.18 * (hits.length - 1));
    const weak = hits.every((k) => WEAK_KEYWORDS.has(k));
    combine(fromClusters, CLUSTER_EVIDENCE[cluster.key] ?? {}, strength * (weak ? WEAK_SCALE : 1));
  }

  // ---- source 3: the synopsis --------------------------------------------
  const fromSynopsis: Record<string, number> = {};
  if (overview.length > 40) {
    for (const [re, weights] of SYNOPSIS_EVIDENCE) {
      if (re.test(overview)) combine(fromSynopsis, weights);
    }
  }

  // ---- combine the sources ------------------------------------------------
  const dimensions = {} as Record<SemanticDimension, number>;
  for (const d of DIMENSIONS) dimensions[d] = 0;
  for (const d of DIMENSIONS) {
    const acc: Record<string, number> = {};
    combine(acc, { [d]: fromGenres[d] ?? 0 } as Weights);
    combine(acc, { [d]: fromClusters[d] ?? 0 } as Weights);
    // The synopsis is corroboration, so it is scaled below the other two.
    combine(acc, { [d]: (fromSynopsis[d] ?? 0) * 0.7 } as Weights);
    dimensions[d] = Math.round((acc[d] ?? 0) * 1000) / 1000;
  }

  /**
   * How much this vector rests on.
   *
   * Sources present matters, and sources *agreeing* matters more: a title where
   * genre, keywords and synopsis all point the same way is known, and one
   * carried by a single weak keyword is a guess wearing the same shape.
   */
  /**
   * Availability is most of it, but it cannot be all of it.
   *
   * The first version summed "has genres, has keywords, has a synopsis" to 0.9
   * and added agreement on top, so the median title came out at 1.00 — a
   * confidence that says "certain" about everything is not measuring anything.
   * Availability now caps at 0.7 and the rest has to be earned by the sources
   * actually pointing the same way.
   */
  const present =
    (genres.length > 0 ? 0.25 : 0) +
    (keywords.length >= 6 ? 0.3 : keywords.length >= 3 ? 0.2 : keywords.length > 0 ? 0.1 : 0) +
    (overview.length > 40 ? 0.15 : 0);

  const top = Math.max(...DIMENSIONS.map((d) => dimensions[d]));
  const leaders = (src: Record<string, number>) =>
    new Set(DIMENSIONS.filter((d) => (src[d] ?? 0) > 0.25));
  const g = leaders(fromGenres);
  const c = leaders(fromClusters);
  const y = leaders(fromSynopsis);
  // Agreement means two sources naming the same dimension, not merely both
  // having an opinion about something.
  const overlap = (a: Set<string>, b: Set<string>) => [...a].some((d) => b.has(d));
  const agreements =
    (overlap(g, c) ? 1 : 0) + (overlap(g, y) ? 1 : 0) + (overlap(c, y) ? 1 : 0);

  const confidence = Math.max(
    0,
    Math.min(1, present + agreements * 0.08 + (top > 0.6 ? 0.06 : 0)),
  );

  return {
    dimensions,
    confidence,
    evidence: {
      genres: genres.length,
      clusters: matched.length,
      synopsis: overview.length > 40 ? 1 : 0,
      matched,
    },
    modelVersion: SEMANTIC_MODEL_VERSION,
  };
}

/** The strongest dimensions, for printing and for explanations. */
export function topDimensions(p: SemanticProfile, take = 5) {
  return DIMENSIONS.map((d) => ({ key: d, label: DIMENSION_LABELS[d], value: p.dimensions[d] }))
    .filter((x) => x.value > 0.05)
    .sort((a, b) => b.value - a.value)
    .slice(0, take);
}

/**
 * One semantic profile for a whole series, from the series and its seasons.
 *
 * A season is evidence about the show, so the seasons are averaged into it
 * rather than competing with it. Series-level metadata leads because it
 * describes the work; seasons fill in what it leaves out.
 */
export function combineForShow(
  series: SemanticInput,
  seasons: SemanticInput[],
): SemanticProfile {
  const head = semanticProfile(series);
  if (seasons.length === 0) return head;

  const parts = seasons.map(semanticProfile);
  const dimensions = {} as Record<SemanticDimension, number>;
  for (const d of DIMENSIONS) {
    const seasonMean = parts.reduce((n, p) => n + p.dimensions[d], 0) / parts.length;
    dimensions[d] = Math.round((0.6 * head.dimensions[d] + 0.4 * seasonMean) * 1000) / 1000;
  }
  return {
    dimensions,
    confidence: Math.max(head.confidence, ...parts.map((p) => p.confidence)),
    evidence: {
      genres: head.evidence.genres,
      clusters: head.evidence.clusters,
      synopsis: head.evidence.synopsis,
      matched: [...new Set([...head.evidence.matched, ...parts.flatMap((p) => p.evidence.matched)])],
    },
    modelVersion: SEMANTIC_MODEL_VERSION,
  };
}
