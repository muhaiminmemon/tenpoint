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
  tierStanding,
  computeVariant,
  readArchetype,
  themeReadings,
  RARITY_TIERS,
  STOCK_DEFS,
  type ArchetypeRead,
  type AxisDef,
  type ThemeReading,
  type RarityTier,
  type StockDef,
} from "./taste-card";
import { getTasteSignals } from "./taste-card-signals";
import { pickSignatureFilms, type SignatureFilm } from "./signature-films";
import { inThirdPerson } from "./voice";
import {
  CLASS_THRESHOLD,
  computePersonality,
  getTasteProfile,
  type PersonalityAxis,
} from "./taste";
import { getHeldVariantNames } from "./variant-history";
import { eq as eqOp } from "drizzle-orm";
import { db } from "@/db";
import { users as usersTable } from "@/db/schema";

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
  /** the themes this library actually runs on, and what each one means */
  themes: ThemeReading[];
  /** the four films on the card, and the job each one is doing */
  signature: SignatureFilm[];
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
export async function loadBinder(
  user: { id: string },
  { thirdPerson = false }: { thirdPerson?: boolean } = {},
): Promise<Binder> {
  /**
   * A viewing marked "only me" stays only theirs, here too.
   *
   * This read private entries unconditionally, which meant a friend looking at
   * somebody's binder was shown signature films, personality shares, themes and
   * traits computed from viewings that person had deliberately hidden — and the
   * signature panel names those films outright. It also produced the symptom
   * that surfaced it: the card respects the flag and the binder did not, so the
   * two disagreed about the same person's own quartet.
   */
  const includePrivate = !thirdPerson;
  const taste = await getTasteProfile(user.id, { includePrivate });
  const signals = await getTasteSignals(user.id, { includePrivate });

  const hasCard = taste.rated > 0;
  const tier = hasCard ? tierStanding(signals).tier : null;

  /**
   * The highest tier this account ever reached.
   *
   * Rank is depth now, and depth can fall: delete a run of entries and the tier
   * goes with them. Deriving "held" from the current tier alone would then quietly
   * un-collect finishes somebody had genuinely earned, which is the one thing a
   * binder must not do.
   */
  const floorRow = await db
    .select({ tierFloor: usersTable.tierFloor })
    .from(usersTable)
    .where(eqOp(usersTable.id, user.id))
    .limit(1);
  const everReached = RARITY_TIERS.findIndex((t) => t.name === floorRow[0]?.tierFloor);
  const variant = computeVariant(
    signals,
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
      ? (() => {
          const read = readArchetype(taste.topGenres[0]?.name, taste.topGenres, signals);
          // Told about them rather than to them, on their friend's screen.
          return thirdPerson
            ? {
                ...read,
                modifierMeaning: inThirdPerson(read.modifierMeaning),
                nounMeaning: inThirdPerson(read.nounMeaning),
                meaning: inThirdPerson(read.meaning),
                nearMiss: read.nearMiss ? inThirdPerson(read.nearMiss) : undefined,
              }
            : read;
        })()
      : null;

  const tiers: TierRow[] = RARITY_TIERS.map((t) => ({
    tier: t,
    state:
      tier === null
        ? "unheld"
        : t.index === tier.index
          ? "yours"
          : t.index < tier.index || t.index <= everReached
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
    personality: computePersonality(taste, signals).map((axis) =>
      thirdPerson ? { ...axis, note: inThirdPerson(axis.note) } : axis,
    ),
    themes: themeReadings(signals, 6),
    signature: (
      await pickSignatureFilms(user.id, signals, archetype?.themeKey ?? null, {
        includePrivate,
      })
    ).map((f) => (thirdPerson ? { ...f, reason: inThirdPerson(f.reason) } : f)),
    yoursVariant,
    yoursTier: tier,
    archetype,
    toArchetype: Math.max(0, CLASS_THRESHOLD - taste.rated),
    rated: taste.rated,
  };
}
