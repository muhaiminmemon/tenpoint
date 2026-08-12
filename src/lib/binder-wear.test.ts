import { describe, expect, it } from "vitest";
import { STOCK_BY_CLUSTER } from "./archetype-clusters";
import { leadingCluster } from "./taste-card";

/**
 * The "watch n more and it goes back on your card" number.
 *
 * The binder searches for it by asking `leadingCluster` repeatedly, so the only
 * ways it can be wrong are an off-by-one or a k that does not actually flip the
 * card. Both are checked against the same function the card is printed from: at
 * k the stock must lead, and at k - 1 it must not.
 *
 * Nothing here hardcodes which theme wins a given shelf. Cluster prevalence is
 * catalogue data and it moves; a fixture asserting "this shelf reads Filmstrip"
 * tests the catalogue rather than the search, and breaks for the wrong reason
 * when the catalogue is re-fitted. The starting stock is read, then a different
 * one is aimed at.
 */
const CAP = 400;

const stockAt = (
  themeKey: string,
  weighted: Record<string, number>,
  total: number,
  k: number,
): string | null => {
  const probe = { ...weighted, [themeKey]: (weighted[themeKey] ?? 0) + k };
  const lead = leadingCluster(probe, total + k);
  return lead ? (STOCK_BY_CLUSTER[lead] ?? null) : null;
};

function titlesToWear(
  stockName: string,
  themeKey: string,
  weighted: Record<string, number>,
  total: number,
): number | null {
  for (let k = 1; k <= CAP; k++) {
    if (stockAt(themeKey, weighted, total, k) === stockName) return k;
  }
  return null;
}

describe("titlesToWear", () => {
  const shelf: Record<string, number> = { caped: 60, romance: 21, myth: 12, slasher: 9 };
  const total = 300;

  // Whatever the catalogue currently makes of this shelf, aim somewhere else.
  const startingStock = stockAt("romance", shelf, total, 0);
  const target = STOCK_BY_CLUSTER["romance"];

  it("aims at a stock the shelf is not already wearing", () => {
    expect(target).toBeTruthy();
    expect(startingStock).not.toBe(target);
  });

  it("finds a k that actually puts the target stock on the card", () => {
    const k = titlesToWear(target, "romance", shelf, total);
    expect(k).not.toBeNull();
    expect(stockAt("romance", shelf, total, k!)).toBe(target);
  });

  it("is the first such k, not a later one", () => {
    const k = titlesToWear(target, "romance", shelf, total)!;
    expect(stockAt("romance", shelf, total, k - 1)).not.toBe(target);
  });

  it("holds on a thin shelf too, where the count floor binds instead", () => {
    const thin: Record<string, number> = { caped: 6 };
    const k = titlesToWear(target, "romance", thin, 12);
    expect(k).not.toBeNull();
    expect(stockAt("romance", thin, 12, k!)).toBe(target);
    expect(stockAt("romance", thin, 12, k! - 1)).not.toBe(target);
  });

  it("gives up rather than inventing a number when nothing reaches it", () => {
    // A leader two orders of magnitude ahead cannot be caught inside the cap,
    // and a made-up number would be worse than saying so.
    expect(titlesToWear(target, "romance", { caped: 5000 }, 20000)).toBeNull();
  });
});
