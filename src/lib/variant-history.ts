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
  await recordHeldVariants(userId, [variantName]);
}

/**
 * The same, for every finish a library has earned rather than only the one it
 * is wearing.
 *
 * Recording the printed finish alone is what kept a binder at one held stock
 * forever: a library concentrated in one theme prints one finish for life, so
 * the only row it could ever write was the row it already had. One statement
 * rather than one per name, because this runs on every card read.
 */
export async function recordHeldVariants(userId: string, names: string[]): Promise<void> {
  const values = [...new Set(names.filter(Boolean))].map((variantName) => ({
    userId,
    variantName,
  }));
  if (values.length === 0) return;
  await db
    .insert(heldVariants)
    .values(values)
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
