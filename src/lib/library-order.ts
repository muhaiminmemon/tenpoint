import { db } from "@/db";
import { libraryOrder } from "@/db/schema";
import { needsRenumber, sortKeyBetween } from "./placement";

export type Edge = { filmId: string; rating: number | null; sortKey: number } | null;

/**
 * Keeps a row where it was put, when its rating alone would not.
 *
 * A rating nobody else holds sorts itself and needs nothing written here. A
 * rating shared with a neighbour does: without a key, a film dropped between
 * two tens lands wherever the alphabet puts it, which is not where it was
 * dropped.
 *
 * `sort_key` is `double precision` so the ordinary case is a single write —
 * one number between two that already exist, the same trick
 * `watchlist.position` uses.
 */
export async function keepTheSpot(
  userId: string,
  filmId: string,
  rating: number,
  above: Edge,
  below: Edge,
  band: { filmId: string; rating: number | null }[],
) {
  const aboveKey = above && above.rating === rating ? above.sortKey : null;
  const belowKey = below && below.rating === rating ? below.sortKey : null;
  if (aboveKey === null && belowKey === null) return;

  let sortKey = sortKeyBetween(aboveKey, belowKey);

  /**
   * A band nobody has ever ordered has every key at the column default, so
   * there is no gap to halve and the alphabetical fallback is doing the
   * ordering. The same is true once repeated dropping at one point has
   * exhausted the mantissa. Both are cured by numbering the band as it stands
   * before writing into it: many writes once, one write from then on.
   */
  if (needsRenumber(aboveKey, belowKey)) {
    const members = band.filter((f) => f.rating === rating && f.filmId !== filmId);
    await db.transaction(async (tx) => {
      for (const [i, f] of members.entries()) {
        const key = (i + 1) * 100;
        await tx
          .insert(libraryOrder)
          .values({ userId, filmId: f.filmId, sortKey: key })
          .onConflictDoUpdate({
            target: [libraryOrder.userId, libraryOrder.filmId],
            set: { sortKey: key },
          });
      }
    });
    const seat = members.findIndex((f) => f.filmId === below?.filmId);
    sortKey = seat === -1 ? (members.length + 1) * 100 : seat * 100 + 50;
  }

  await db
    .insert(libraryOrder)
    .values({ userId, filmId, sortKey })
    .onConflictDoUpdate({
      target: [libraryOrder.userId, libraryOrder.filmId],
      set: { sortKey },
    });
}
