import {
  DIMENSIONS,
  DIMENSION_LABELS,
  SEMANTIC_MODEL_VERSION,
  semanticProfile,
  type SemanticDimension,
  type SemanticInput,
} from "./semantic";

/**
 * A person in the semantic space, twice: what they watch and what they love.
 *
 * The v1 profile counted cluster memberships and split a title's affection
 * evenly across everything it matched, so a work that is overwhelmingly one
 * thing and incidentally another was filed as half of each. Here a title
 * contributes its *strength* in every dimension, and affection multiplies that
 * vector rather than being divided by it.
 *
 * Exposure and preference are the same arithmetic over the same vectors, with
 * and without the affection weight. That is deliberate and load-bearing: the
 * only honest way to say "you love this more than you watch it" is for both
 * halves to be measured on one ruler.
 */

export type SemanticPreferenceProfile = {
  /** affection-weighted: the library they respond to */
  preference: Record<SemanticDimension, number>;
  /** unweighted: the library they accumulated */
  exposure: Record<SemanticDimension, number>;
  /**
   * preference ÷ exposure per dimension, the only number that separates taste
   * from availability. 1.0 means loved exactly as often as watched.
   */
  affinity: Record<SemanticDimension, number>;
  /** mean semantic confidence across the titles this was built from */
  confidence: number;
  titles: number;
  modelVersion: number;
};

export type SemanticProfileInput = SemanticInput & {
  /** 0-1, how much this person loves it */
  affection: number;
};

const zero = () => {
  const r = {} as Record<SemanticDimension, number>;
  for (const d of DIMENSIONS) r[d] = 0;
  return r;
};

export function buildSemanticPreferenceProfile(
  inputs: SemanticProfileInput[],
): SemanticPreferenceProfile {
  const pref = zero();
  const exp = zero();
  let prefWeight = 0;
  let expWeight = 0;
  let confSum = 0;

  for (const t of inputs) {
    const p = semanticProfile(t);
    confSum += p.confidence;

    /**
     * Low-confidence semantics contribute less to a claim about a person.
     *
     * A title carried by one weak keyword still counts — excluding it would be
     * the old mistake of treating unknown as absent — but it should not shape an
     * identity as firmly as a title three sources agree about.
     */
    const trust = 0.4 + 0.6 * p.confidence;
    const a = Math.max(0, t.affection);

    for (const d of DIMENSIONS) {
      const s = p.dimensions[d];
      if (s <= 0) continue;
      pref[d] += a * s * trust;
      exp[d] += s * trust;
    }
    prefWeight += a * trust;
    expWeight += trust;
  }

  const norm = (v: Record<SemanticDimension, number>, w: number) => {
    const out = zero();
    const total = Math.max(1e-9, w);
    for (const d of DIMENSIONS) out[d] = v[d] / total;
    return out;
  };

  const preference = norm(pref, prefWeight);
  const exposure = norm(exp, expWeight);

  const affinity = zero();
  for (const d of DIMENSIONS) {
    // Only meaningful where there is enough exposure to divide by; a dimension
    // nobody watches cannot be one they disproportionately love.
    affinity[d] = exposure[d] > 0.02 ? preference[d] / exposure[d] : 1;
  }

  return {
    preference,
    exposure,
    affinity,
    confidence: inputs.length ? confSum / inputs.length : 0,
    titles: inputs.length,
    modelVersion: SEMANTIC_MODEL_VERSION,
  };
}

export function ranked(
  v: Record<SemanticDimension, number>,
  take = 5,
): { key: SemanticDimension; label: string; value: number }[] {
  return DIMENSIONS.map((d) => ({ key: d, label: DIMENSION_LABELS[d], value: v[d] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, take);
}

/** The dimensions somebody loves most relative to how much they watch them. */
export function strongestAffinities(p: SemanticPreferenceProfile, take = 4) {
  return DIMENSIONS.map((d) => ({
    key: d,
    label: DIMENSION_LABELS[d],
    affinity: p.affinity[d],
    exposure: p.exposure[d],
    preference: p.preference[d],
  }))
    // A dimension needs real exposure behind it before its ratio means anything.
    .filter((x) => x.exposure > 0.04)
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, take);
}
