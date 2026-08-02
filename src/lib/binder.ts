/**
 * The binder: every finish the taste card can be dealt, and which of them
 * this person has.
 *
 * A showcase, not a game. There is no total, no ratio, no completion figure
 * and nothing to configure — the only facts here are which finishes exist and
 * which ones are yours. Two of the three states are earned by watching films;
 * none of them is chosen.
 *
 * Tiers need no history: they are a floor on rated films, which only ever goes
 * up, so everything below your current tier was genuinely passed through.
 * Variants do need history — they are recomputed from current taste, so the
 * one you held last year is gone unless something wrote it down.
 */
import {
  ACCENT_DEFS,
  AURA_DEFS,
  computeTier,
  computeVariant,
  readArchetype,
  RARITY_TIERS,
  STOCK_DEFS,
  type ArchetypeRead,
  type AxisDef,
  type RarityTier,
  type StockDef,
} from "./taste-card";
import { getTasteSignals } from "./taste-card-signals";
import {
  CLASS_THRESHOLD,
  computePersonality,
  getTasteProfile,
  type PersonalityAxis,
} from "./taste";
import { getHeldVariantNames } from "./variant-history";

/** Yours right now, held at some point, or never held. */
export type FinishState = "yours" | "held" | "unheld";

export type TierRow = { tier: RarityTier; state: FinishState };

/**
 * One finish. The stock *is* the finish, so its printed name and its material
 * are the same fact read two ways.
 */
export type VariantRow = {
  /** the finish's printed name, e.g. "Filmstrip" */
  name: string;
  stock: StockDef;
  state: FinishState;
};

export type AxisRow = { axis: AxisDef; yours: boolean };

/**
 * One axis of the personality profile, and what it is a share of.
 *
 * Unlike a tier or a finish there is nothing here to hold, so the binder's job
 * for these is different: it prints what each number actually counts, so a
 * reader can check the figures on their card against their own library rather
 * than taking them on trust. Only the axes a person's library supports are in
 * here at all, which is why this section has no unheld state.
 */
export type PersonalityRow = PersonalityAxis;

/**
 * The reading of the person, split into the two halves it is built from.
 *
 * Only ever the one in force. Unlike a tier or a finish, an archetype is not
 * something anyone collects — it is what the library currently says about you,
 * so a catalogue of the ones you don't have would be a list of other people.
 */
export type { ArchetypeRead };

export type Binder = {
  tiers: TierRow[];
  variants: VariantRow[];
  accents: AxisRow[];
  auras: AxisRow[];
  personality: PersonalityRow[];
  /** null before anything is rated: no finish is in force yet */
  yoursVariant: string | null;
  yoursTier: RarityTier | null;
  /** null until enough is rated for the card to name one */
  archetype: ArchetypeRead | null;
  /** films still needed before an archetype is named */
  toArchetype: number;
  rated: number;
};

/**
 * Builds the whole showcase for one user, and notes the finish they currently
 * hold on the way through so it is in their history from the first visit.
 */
export async function loadBinder(user: { id: string }): Promise<Binder> {
  const taste = await getTasteProfile(user.id, { includePrivate: true });
  const signals = await getTasteSignals(user.id, { includePrivate: true });

  const hasCard = taste.rated > 0;
  const tier = hasCard ? computeTier(taste.rated, signals) : null;
  const variant = computeVariant(
    taste.topGenres[0]?.name,
    signals.topRatedDecade,
    taste.topDecade?.decade ?? null,
    taste.mean,
  );
  const yoursVariant = hasCard ? variant.name : null;

  const everHeld = await getHeldVariantNames(user.id);

  // The same call the card uses. This used to rebuild the title from the same
  // two tables by hand, which is how a binder and a card end up explaining
  // different words to the same person.
  const archetype: ArchetypeRead | null =
    taste.rated >= CLASS_THRESHOLD
      ? readArchetype(taste.topGenres[0]?.name, taste.topDecade?.decade ?? null, signals)
      : null;

  const tiers: TierRow[] = RARITY_TIERS.map((t) => ({
    tier: t,
    state:
      tier === null
        ? "unheld"
        : t.index === tier.index
          ? "yours"
          : t.index < tier.index
            ? "held"
            : "unheld",
  }));

  const variants: VariantRow[] = STOCK_DEFS.map((stock) => ({
    name: stock.name,
    stock,
    state:
      stock.name === yoursVariant ? "yours" : everHeld.has(stock.name) ? "held" : "unheld",
  }));

  return {
    tiers,
    variants,
    accents: ACCENT_DEFS.map((axis) => ({ axis, yours: hasCard && variant.accent === axis.name })),
    auras: AURA_DEFS.map((axis) => ({ axis, yours: hasCard && variant.aura === axis.name })),
    personality: computePersonality(taste, signals),
    yoursVariant,
    yoursTier: tier,
    archetype,
    toArchetype: Math.max(0, CLASS_THRESHOLD - taste.rated),
    rated: taste.rated,
  };
}
