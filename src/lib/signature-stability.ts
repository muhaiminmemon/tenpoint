import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { signatureHistory, signatureSets } from "@/db/schema";
import type { SignatureTitle } from "./signature";

/**
 * Keeping the card still unless something has genuinely changed.
 *
 * Every component of a signature score moves a little whenever anything is
 * rated: the mean shifts, the preference profile shifts, and a title sitting a
 * thousandth behind the incumbent takes its place. Nothing about the person
 * changed, but their card did, and a card that reshuffles every time you log a
 * film is not a portrait of anybody.
 *
 * So the incumbent quartet is held unless a challenger beats it by a margin
 * wide enough to mean something. The margin is on the *set*, not on individual
 * titles, because swapping one member changes what the other three are covering.
 */

/**
 * How much better a challenging set has to be.
 *
 * Roughly a twentieth of a typical set score. Small enough that a real change of
 * taste — a new favourite, a series finished, twenty films rated — moves the
 * card within a session or two. Large enough that recomputing the same library
 * twice never does.
 */
const CHALLENGER_MARGIN = 0.05;

export type StableSignature = {
  titles: SignatureTitle[];
  /** true when the incumbent was kept because the challenger fell short */
  held: boolean;
  /** what moved, when something did */
  change: { added: string[]; removed: string[] } | null;
};

const setScoreOf = (titles: SignatureTitle[]) =>
  titles.reduce((sum, t) => sum + t.score, 0);

/**
 * Reconcile a freshly computed quartet against the one on record.
 *
 * Returns the set that should be shown, and writes the new one only when it has
 * actually won. A caller that cannot write — a visitor viewing somebody else's
 * profile, where the computation is scoped to public entries and would be the
 * wrong thing to persist — passes `persist: false` and gets the comparison
 * without the side effect.
 */
export async function stabilise(
  userId: string,
  fresh: SignatureTitle[],
  { persist = true }: { persist?: boolean } = {},
): Promise<StableSignature> {
  if (fresh.length === 0) return { titles: fresh, held: false, change: null };

  const rows = await db
    .select()
    .from(signatureSets)
    .where(eq(signatureSets.userId, userId))
    .limit(1);
  const incumbent = rows[0];
  const freshScore = setScoreOf(fresh);

  if (!incumbent) {
    if (persist) {
      await db.insert(signatureSets).values({
        userId,
        titles: fresh.map((t) => ({ slug: t.slug, score: t.score })),
        setScore: freshScore,
      });
    }
    return { titles: fresh, held: false, change: null };
  }

  const heldSlugs = incumbent.titles.map((t) => t.slug);
  const freshSlugs = fresh.map((t) => t.slug);
  const identical =
    heldSlugs.length === freshSlugs.length &&
    heldSlugs.every((s) => freshSlugs.includes(s));

  if (identical) {
    // Same four. The scores drift constantly, so the stored set is refreshed
    // without touching `changedAt` — nothing changed that a reader would call a
    // change.
    if (persist && Math.abs(freshScore - incumbent.setScore) > 0.001) {
      await db
        .update(signatureSets)
        .set({ titles: fresh.map((t) => ({ slug: t.slug, score: t.score })) , setScore: freshScore })
        .where(eq(signatureSets.userId, userId));
    }
    return { titles: fresh, held: false, change: null };
  }

  // A different set. It only takes the card if it is clearly better.
  if (freshScore < incumbent.setScore + CHALLENGER_MARGIN) {
    /**
     * The incumbent wins, but it has to be rebuilt from the fresh scoring
     * rather than replayed from storage: the stored row holds slugs and scores,
     * not the sentences, and those depend on the current profile. Any incumbent
     * title that is no longer a candidate at all — deleted, or now private —
     * cannot be rebuilt, and in that case the challenger is accepted because
     * holding a card that names a title the person removed is worse than moving.
     */
    const byslug = new Map(fresh.map((t) => [t.slug, t]));
    const rebuilt = heldSlugs.map((s) => byslug.get(s)).filter((t): t is SignatureTitle => Boolean(t));
    if (rebuilt.length === heldSlugs.length) {
      return { titles: rebuilt, held: true, change: null };
    }
  }

  const removed = heldSlugs.filter((s) => !freshSlugs.includes(s));
  const added = freshSlugs.filter((s) => !heldSlugs.includes(s));

  if (persist) {
    await db
      .update(signatureSets)
      .set({
        titles: fresh.map((t) => ({ slug: t.slug, score: t.score })),
        setScore: freshScore,
        changedAt: new Date(),
      })
      .where(eq(signatureSets.userId, userId));
    // One row per genuine change, never per recomputation.
    if (removed.length > 0 || added.length > 0) {
      await db.insert(signatureHistory).values({ userId, removed, added });
    }
  }

  return { titles: fresh, held: false, change: { added, removed } };
}

export type SignatureChange = {
  removed: string[];
  added: string[];
  createdAt: Date;
};

/** What has moved on this card, most recent first. */
export async function getSignatureHistory(
  userId: string,
  limit = 5,
): Promise<SignatureChange[]> {
  const rows = await db
    .select({
      removed: signatureHistory.removed,
      added: signatureHistory.added,
      createdAt: signatureHistory.createdAt,
    })
    .from(signatureHistory)
    .where(eq(signatureHistory.userId, userId))
    .orderBy(desc(signatureHistory.createdAt))
    .limit(limit);
  return rows;
}
