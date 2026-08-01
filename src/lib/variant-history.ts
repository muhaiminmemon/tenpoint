import { eq } from "drizzle-orm";
import { db } from "@/db";
import { heldVariants } from "@/db/schema";

/**
 * The record of which finishes a person has ever held.
 *
 * A variant is computed from current taste rather than collected, so it can
 * change out from under someone the moment their leading genre or rating
 * spread moves. This is the only place the old one survives.
 */

/**
 * Notes that this user currently holds this finish. Idempotent: the first
 * write wins and `first_held_at` never moves, so re-holding a finish you had
 * two years ago does not rewrite when you first had it.
 */
export async function recordHeldVariant(userId: string, variantName: string): Promise<void> {
  if (!variantName) return;
  await db
    .insert(heldVariants)
    .values({ userId, variantName })
    .onConflictDoNothing({ target: [heldVariants.userId, heldVariants.variantName] });
}

/** Every finish this user has ever held, as a set for cheap lookup. */
export async function getHeldVariantNames(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ variantName: heldVariants.variantName })
    .from(heldVariants)
    .where(eq(heldVariants.userId, userId));
  return new Set(rows.map((r) => r.variantName));
}
