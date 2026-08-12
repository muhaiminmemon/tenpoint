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
  libraryDepth,
  titlesToSignature,
  type ArchetypeRead,
  type AxisDef,
  type ThemeReading,
  type RarityTier,
  type StockDef,
} from "./taste-card";
import { CLUSTERS, STOCK_BY_CLUSTER } from "./archetype-clusters";
import { decadeLabel, formatTenths } from "./format";
import { getTasteSignals } from "./taste-card-signals";
import { pickSignatureTitles, type SignatureTitle } from "./signature";
import { stabilise } from "./signature-stability";
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

/**
 * A finish and how far off it is, in the unit that actually issues it.
 *
 * `null` where a distance would have to be invented. Only the theme stocks and
 * the tier ladder are counted in titles and points; the accent reads which
 * decade a person rates highest and the aura reads their average, and neither
 * of those moves by watching a fixed number of anything. Printing "8 more
 * films" against an average would be a number nobody could check.
 */
export type Distance = string | null;

export type TierRow = { tier: RarityTier; state: FinishState; distance: Distance };

/**
 * One finish. The stock *is* the finish, so its printed name and its material
 * are the same fact read two ways.
 */
export type VariantRow = {
  /** the finish's printed name, e.g. "Filmstrip" */
  name: string;
  stock: StockDef;
  state: FinishState;
  distance: Distance;
};

export type AxisRow = { axis: AxisDef; yours: boolean; distance: Distance };

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
  signature: SignatureTitle[];
  /** null before anything is rated: no finish is in force yet */
  yoursVariant: string | null;
  /** every finish this library has earned, for the owner-visit write */
  heldVariantNames: string[];
  yoursTier: RarityTier | null;
  /** null until enough is rated for the card to name one */
  archetype: ArchetypeRead | null;
  /** films still needed before an archetype is named */
  toArchetype: number;
  rated: number;
};

const CLUSTER_BY_KEY = new Map(CLUSTERS.map((c) => [c.key, c]));

/** Which themes can issue each stock, inverted from the cluster → stock map. */
const CLUSTERS_BY_STOCK = (() => {
  const out = new Map<string, string[]>();
  for (const [cluster, stock] of Object.entries(STOCK_BY_CLUSTER)) {
    const list = out.get(stock) ?? [];
    list.push(cluster);
    out.set(stock, list);
  }
  return out;
})();

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * What it would take to hold this finish, said outright.
 *
 * Named in full — the finish, the theme, the number, and what they already
 * have — because the reader is looking at one row out of twelve and a bare
 * "11 short" makes them work out which finish and which theme it is short of.
 * The theme is the note's own plain words, which were written to slot into
 * "your films are about ___", so the sentence reads as the product speaks.
 *
 * Second person like every other line here, so the same `inThirdPerson` pass
 * that re-voices the conditions re-voices these and the two never disagree on
 * somebody else's binder.
 */
function stockDistance(
  stockName: string,
  state: FinishState,
  counts: Record<string, number>,
  weighted: Record<string, number>,
  total: number,
): Distance {
  const themes = CLUSTERS_BY_STOCK.get(stockName);
  if (!themes?.length || total <= 0) return null;

  const rows = themes
    .map((key) => ({
      key,
      count: counts[key] ?? 0,
      short: titlesToSignature(key, counts, total),
      // A finish can be issued on the weighted reading while the plain counts
      // still fall short, so "you hold it on" has to ask the same question the
      // issuing rule asked or it names a theme that earned nothing.
      qualifies:
        titlesToSignature(key, counts, total) === 0 ||
        titlesToSignature(key, weighted, total) === 0,
    }))
    .sort(
      (a, b) => Number(b.qualifies) - Number(a.qualifies) || a.short - b.short || b.count - a.count,
    );

  const nearest = rows[0];
  const cluster = CLUSTER_BY_KEY.get(nearest.key);
  if (!cluster) return null;
  /**
   * The theme's whole note, not just its first word.
   *
   * `clusterLabel` trims to the head for places that need a short name, and
   * that head was doing real damage here: "titles about magic" reads as any
   * film a person would call magical, while the theme is thirteen specific
   * keywords. Printing the full note — "magic, wizards, dragons and prophecy" —
   * describes what actually counts.
   */
  const subject = cluster.note;
  const have = `You have ${plural(nearest.count, "title")}.`;

  // Deliberately not "you hold": a stock can be earned and sitting in the
  // binder while the card wears a different one, and "hold" read as "wearing".
  // Which of the two it is, the state mark beside the row already says.
  if (nearest.qualifies) return `Earned on ${plural(nearest.count, "title")} about ${subject}.`;
  const need = `${plural(nearest.short, "more title")} about ${subject}`;
  if (state !== "unheld") {
    return `Earned before, but not on the shelf as it stands. To earn it again you need ${need}. ${have}`;
  }
  return `To earn ${stockName} you need ${need}. ${have}`;
}

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

  /** The bare-string form of `revoice`, for the distances built below. */
  const revoiceText = (text: Distance): Distance =>
    text !== null && thirdPerson ? inThirdPerson(text) : text;

  /**
   * Where the reader stands on the two axes that are not counted in titles.
   *
   * One line each, printed against every option on the axis rather than only
   * the one they hold: the question a reader has looking at Crimson is "what is
   * mine, then", and the answer is the same sentence whichever row they are
   * reading. The accent reads the decade they rate highest — not the one they
   * watch most — so the line says so, because the two are different facts and
   * the card would otherwise look wrong to anybody whose favourite decade is
   * not their biggest.
   */
  const accentDecade = signals.topRatedDecade ?? taste.topDecade?.decade ?? null;
  const accentStanding: Distance =
    accentDecade === null
      ? "Your accent comes from the decade you rate highest. You have not rated anything yet."
      : `Your accent comes from the decade you rate highest, which is the ${decadeLabel(accentDecade)}.`;
  const auraStanding: Distance =
    taste.mean === null
      ? "Your aura comes from your average rating. You have not rated anything yet."
      : `Your aura comes from your average rating, which is ${formatTenths(taste.mean)}.`;

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

  /**
   * Re-voice the fixed definitions.
   *
   * `RARITY_TIERS`, `STOCK_DEFS` and the axis tables are all written in the
   * second person, because the common case is somebody reading their own
   * binder. On a friend's every one of them is describing the wrong person —
   * "Your films keep returning to the dark" printed under somebody else's name
   * is the same bug the archetype and signature lines already had fixed here.
   * The readings above go through `inThirdPerson` one field at a time; these
   * are static tables, so they go through it one *key* at a time instead.
   */
  const revoice = <T extends Record<string, unknown>>(def: T, ...keys: (keyof T)[]): T => {
    if (!thirdPerson) return def;
    const out = { ...def };
    for (const key of keys) {
      const value = out[key];
      if (typeof value === "string") out[key] = inThirdPerson(value) as T[keyof T];
    }
    return out;
  };

  const depth = hasCard ? libraryDepth(signals).depth : 0;
  const tiers: TierRow[] = RARITY_TIERS.map((t) => ({
    tier: revoice(t, "range", "effect"),
    // Points, because points are what the ladder is issued on — the same
    // figure the card's own gate quotes, read off one depth calculation.
    distance: revoiceText(
      t.depth <= depth
        ? null
        : `To reach ${t.name} you need ${plural(t.depth - depth, "more point")}. You have ${plural(depth, "point")}.`,
    ),
    state:
      tier === null
        ? "unheld"
        : t.index === tier.index
          ? "yours"
          : t.index < tier.index || t.index <= everReached
            ? "held"
            : "unheld",
  }));

  /**
   * Earned now counts as held, without waiting for a second page load.
   *
   * `held_variants` is written on the owner's own visit, so a finish earned
   * this minute would otherwise render unheld until the next one. Reading the
   * computed set alongside the recorded one keeps the binder honest on the
   * first load, and the write below makes it durable.
   */
  const earned = hasCard ? new Set([...everHeld, ...variant.held]) : everHeld;

  const variants: VariantRow[] = STOCK_DEFS.map((stock) => {
    const state: FinishState =
      stock.name === yoursVariant ? "yours" : earned.has(stock.name) ? "held" : "unheld";
    return {
      name: stock.name,
      stock: revoice(stock, "condition"),
      state,
      distance: revoiceText(
        stockDistance(
          stock.name,
          state,
          signals.clusters,
          signals.clustersWeighted,
          signals.clusterFilmCount,
        ),
      ),
    };
  });

  return {
    tiers,
    variants,
    accents: ACCENT_DEFS.map((axis) => ({
      axis: revoice(axis, "condition"),
      yours: hasCard && variant.accent === axis.name,
      distance: revoiceText(accentStanding),
    })),
    auras: AURA_DEFS.map((axis) => ({
      axis: revoice(axis, "condition"),
      yours: hasCard && variant.aura === axis.name,
      distance: revoiceText(auraStanding),
    })),
    personality: computePersonality(taste, signals).map((axis) =>
      thirdPerson ? { ...axis, note: inThirdPerson(axis.note) } : axis,
    ),
    // Ten rather than six. The remainder row is a real share and on a varied
    // shelf it was the biggest bar on the chart: six rows left 43% of the
    // average library in it, ten leaves 28%. The binder has the room, and
    // this is the page somebody comes to actually read the breakdown.
    themes: themeReadings(signals, 10),
    signature: (
      await stabilise(
        user.id,
        (await pickSignatureTitles(user.id, signals, { includePrivate })).titles,
        // A friend's view is scoped to public entries; persisting it would let
        // their visit rewrite the owner's incumbent quartet.
        { persist: includePrivate },
      )
    ).titles.map((f) =>
      thirdPerson
        ? {
            ...f,
            reason: inThirdPerson(f.reason),
            // The supporting lines are written in the second person too, and
            // reading "You have been back to it 3 times" on somebody else's
            // binder is the same bug the reason line already had fixed.
            supportingReasons: f.supportingReasons.map(inThirdPerson),
          }
        : f,
    ),
    yoursVariant,
    heldVariantNames: hasCard ? variant.held : [],
    yoursTier: tier,
    archetype,
    toArchetype: Math.max(0, CLASS_THRESHOLD - taste.rated),
    rated: taste.rated,
  };
}
