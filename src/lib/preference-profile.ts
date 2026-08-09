import { CLUSTERS, CLUSTER_PREVALENCE, KEYWORD_STOPLIST } from "./archetype-clusters";

/**
 * The one description of what somebody likes, shared by everything that needs
 * one.
 *
 * The card used to hold four disagreeing answers: the archetype counted themes
 * one way, Signature Titles extracted them another way without the stoplist,
 * Theme DNA read a third set of numbers, and Taste Match compared a fourth. The
 * same film could be "about magic" in one panel and carry no theme at all in
 * the next. This is the single reading they are all meant to share.
 *
 * Two things make it a *preference* profile rather than a viewing profile:
 * every title is weighted by how much the person actually loved it, and the
 * result is expressed against how common each theme is, so a shelf full of
 * adventure films does not come out "an adventure watcher" simply because half
 * the catalogue is adventure.
 */

/** Themes only, normalised so two profiles can be compared with a dot product. */
export type PreferenceProfile = {
  /** cluster key → share of the loved library, summing to 1 */
  themes: Record<string, number>;
  /**
   * The same, expressed as how much more of it there is than a shelf that size
   * would ordinarily hold. This is what "distinctive" reads from.
   */
  lift: Record<string, number>;
  /** the strongest dimensions, already ordered, for explanations */
  top: { key: string; name: string; note: string; share: number; lift: number }[];
  /**
   * Weak supporting dimensions, kept separate so they can never dominate.
   *
   * These are weighted by affection: they describe the library somebody
   * *responds to*, not the one they merely accumulated.
   */
  era: { classic: number; modern: number };
  reach: { wide: number; narrow: number };
  language: { english: number; other: number };
  /**
   * The same three, unweighted.
   *
   * The pair is the whole point. On its own, "38% of what you rate is recent"
   * is exposure — it describes what was available and what got logged. Divided
   * by this, it becomes preference: recent films are over-represented among the
   * ones you actually love, relative to how much recent film you watch at all.
   * Every disposition that reads one of these axes reads the ratio, never the
   * raw share.
   */
  exposure: {
    era: { classic: number; modern: number };
    reach: { wide: number; narrow: number };
    language: { english: number; other: number };
  };
  /**
   * How much of this profile is guesswork.
   *
   * Themes come from TMDB keywords, which arrive lazily. A profile built from
   * forty hydrated titles is worth trusting; one built from four is a shrug,
   * and everything downstream should say so rather than assert a taste.
   */
  confidence: number;
  /** titles that carried at least one usable theme */
  themedCount: number;
  totalCount: number;
};

/** One rated work, whatever kind it is, reduced to what a profile needs. */
export type ProfileInput = {
  keywords: string[] | null;
  year: number | null;
  language: string | null;
  reach: number | null;
  /** 0-1, how much this person loves it; the weight the profile is built on */
  affection: number;
};

/**
 * Keywords to themes, once, everywhere.
 *
 * Signature Titles used to skip the stoplist that every other consumer applied,
 * which is how one title could belong to different themes in two panels of the
 * same card. Nothing may extract themes any other way.
 */
export function themesFor(keywords: string[] | null): Set<string> {
  if (!Array.isArray(keywords) || keywords.length === 0) return new Set();
  const held = new Set(
    keywords.map((k) => k.toLowerCase()).filter((k) => !KEYWORD_STOPLIST.has(k)),
  );
  if (held.size === 0) return new Set();
  return new Set(CLUSTERS.filter((c) => c.keywords.some((k) => held.has(k))).map((c) => c.key));
}

/**
 * The theme a title most *is*, rather than the rarest one it touches.
 *
 * Rarest was the old rule and it read badly: a war film carrying one stray
 * "heist" keyword became a heist film, because heist is rarer. Weighting rarity
 * against how central the theme is to the title's own keyword set keeps rare
 * themes valuable without letting a single stray tag rename the work.
 */
export function primaryThemeFor(keywords: string[] | null): string | null {
  const themes = [...themesFor(keywords)];
  if (themes.length === 0) return null;
  if (themes.length === 1) return themes[0];

  const held = new Set((keywords ?? []).map((k) => k.toLowerCase()));
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const key of themes) {
    const cluster = CLUSTERS.find((c) => c.key === key);
    if (!cluster) continue;
    // how much of this cluster the title actually carries
    const matched = cluster.keywords.filter((k) => held.has(k)).length;
    const prevalence = CLUSTER_PREVALENCE[key] ?? 0.05;
    const score = matched * Math.log(1 / Math.max(0.005, prevalence));
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return best ?? themes[0];
}

const ERA_SPLIT = 1995;
const WIDE_REACH = 50_000;

/**
 * Enough hydrated titles for the shape to be real.
 *
 * Below this the profile is returned with its confidence stated rather than
 * withheld: a thin profile is still the best available answer, and callers that
 * care can refuse to draw conclusions from it.
 */
const CONFIDENT_AT = 40;

export function buildPreferenceProfile(inputs: ProfileInput[]): PreferenceProfile {
  const themeWeight: Record<string, number> = {};
  let themedWeight = 0;
  let themedCount = 0;

  let eraClassic = 0;
  let eraModern = 0;
  let reachWide = 0;
  let reachNarrow = 0;
  let langEnglish = 0;
  let langOther = 0;

  // The same tallies with every title counted once, whatever it was rated.
  let xEraClassic = 0;
  let xEraModern = 0;
  let xReachWide = 0;
  let xReachNarrow = 0;
  let xLangEnglish = 0;
  let xLangOther = 0;

  for (const t of inputs) {
    // A title nobody liked describes what they watched, not what they like.
    const w = Math.max(0, t.affection);
    const themes = themesFor(t.keywords);
    if (themes.size > 0) {
      themedCount++;
      themedWeight += w;
      // Split across the themes it carries so a title with six themes does not
      // outvote a title with one.
      const share = w / themes.size;
      for (const key of themes) themeWeight[key] = (themeWeight[key] ?? 0) + share;
    }

    if (t.year !== null) {
      if (t.year < ERA_SPLIT) {
        eraClassic += w;
        xEraClassic += 1;
      } else {
        eraModern += w;
        xEraModern += 1;
      }
    }
    // Unknown reach is not narrow reach. It is nothing, and contributes to
    // neither side rather than quietly voting for obscurity.
    if (t.reach !== null) {
      if (t.reach >= WIDE_REACH) {
        reachWide += w;
        xReachWide += 1;
      } else {
        reachNarrow += w;
        xReachNarrow += 1;
      }
    }
    if (t.language !== null) {
      if (t.language === "en") {
        langEnglish += w;
        xLangEnglish += 1;
      } else {
        langOther += w;
        xLangOther += 1;
      }
    }
  }

  const themes: Record<string, number> = {};
  const lift: Record<string, number> = {};
  const denom = Math.max(1e-9, themedWeight);
  for (const [key, weight] of Object.entries(themeWeight)) {
    const share = weight / denom;
    themes[key] = share;
    // Five pseudo-titles of shrinkage, the same the archetype uses, so one
    // loved title in a rare theme cannot read as a defining obsession.
    const expected = CLUSTER_PREVALENCE[key] ?? 0.05;
    lift[key] = (share * themedCount + 5 * expected) / ((themedCount + 5) * expected);
  }

  const top = Object.entries(themes)
    .map(([key, share]) => {
      const cluster = CLUSTERS.find((c) => c.key === key);
      return {
        key,
        name: cluster?.name ?? key,
        note: cluster?.note ?? key,
        share,
        lift: lift[key] ?? 1,
      };
    })
    /**
     * Strongest means "more of this than usual, and enough of it to matter".
     *
     * Ranking on share alone named people after whatever is commonest in the
     * catalogue. Ranking on `share × log(1 + lift)` was worse in a way that took
     * real output to see: a theme can score well on that while its lift is below
     * one, which means the person watches *less* of it than average. Three of
     * one test library's "top" dimensions came back at lift 0.4-0.5, so the card
     * was about to describe somebody by the things they avoid.
     *
     * So under-represented themes are pushed below every over-represented one,
     * and only ranked among themselves if nothing at all stands out.
     */
    .sort((a, b) => {
      const over = (t: { lift: number }) => (t.lift >= 1 ? 1 : 0);
      if (over(a) !== over(b)) return over(b) - over(a);
      return b.share * Math.log(1 + b.lift) - a.share * Math.log(1 + a.lift);
    })
    .slice(0, 8);

  const frac = (a: number, b: number) => (a + b > 0 ? a / (a + b) : 0);

  return {
    themes,
    lift,
    top,
    era: { classic: frac(eraClassic, eraModern), modern: frac(eraModern, eraClassic) },
    reach: { wide: frac(reachWide, reachNarrow), narrow: frac(reachNarrow, reachWide) },
    language: { english: frac(langEnglish, langOther), other: frac(langOther, langEnglish) },
    exposure: {
      era: { classic: frac(xEraClassic, xEraModern), modern: frac(xEraModern, xEraClassic) },
      reach: { wide: frac(xReachWide, xReachNarrow), narrow: frac(xReachNarrow, xReachWide) },
      language: {
        english: frac(xLangEnglish, xLangOther),
        other: frac(xLangOther, xLangEnglish),
      },
    },
    confidence: Math.max(0, Math.min(1, themedCount / CONFIDENT_AT)),
    themedCount,
    totalCount: inputs.length,
  };
}

/**
 * How strongly one title expresses this profile, 0-1.
 *
 * Cosine rather than a raw overlap count, so a title carrying eight themes does
 * not beat a title carrying the two that actually matter. Weighted by lift, so
 * matching somebody on a theme they are unusual for counts for more than
 * matching them on one everybody has.
 */
export function representation(profile: PreferenceProfile, keywords: string[] | null): number {
  const themes = themesFor(keywords);
  if (themes.size === 0) return 0;

  let dot = 0;
  let titleNorm = 0;
  for (const key of themes) {
    const w = (profile.themes[key] ?? 0) * Math.log(1 + (profile.lift[key] ?? 1));
    dot += w;
    titleNorm += 1;
  }
  let profileNorm = 0;
  for (const [key, share] of Object.entries(profile.themes)) {
    const w = share * Math.log(1 + (profile.lift[key] ?? 1));
    profileNorm += w * w;
  }
  const denom = Math.sqrt(titleNorm) * Math.sqrt(Math.max(1e-9, profileNorm));
  return denom > 0 ? Math.max(0, Math.min(1, dot / denom)) : 0;
}
