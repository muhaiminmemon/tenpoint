import { describe, expect, it } from "vitest";
import { CLUSTER_PREVALENCE } from "./archetype-clusters";
import { titlesToSignature } from "./taste-card";

/**
 * The distance the binder prints has to be the distance the card enforces.
 *
 * `titlesToSignature` solves for k instead of counting up, so the risk is not a
 * typo but an algebra slip that under- or over-states every answer by a
 * consistent amount — which reads perfectly plausibly on screen. These re-run
 * the issuing rule itself at k and at k-1: exactly at the number it must pass,
 * one below it must fail, and the two together pin the answer with no appeal
 * to the derivation.
 */
const PRIOR = 5;
const MARGIN = 1.35;

/** The rule from `signatureClusters`, restated independently. */
function qualifies(key: string, count: number, total: number): boolean {
  const floor = Math.max(4, Math.round(total * 0.02));
  const expected = total * (CLUSTER_PREVALENCE[key] ?? 0.05);
  const lift = (count + PRIOR) / (expected + PRIOR);
  return count >= floor && lift >= MARGIN;
}

const CASES: { key: string; count: number; total: number }[] = [
  // the most common theme in the catalogue, where the bar is highest
  { key: "hearth", count: 0, total: 100 },
  { key: "hearth", count: 20, total: 300 },
  // a rare theme, where the shrinkage prior does most of the work
  { key: "sport", count: 0, total: 50 },
  { key: "sport", count: 3, total: 400 },
  // an empty library, where the count floor of four binds instead of the lift
  { key: "noir", count: 0, total: 10 },
  // a large library, where the 2% floor binds
  { key: "myth", count: 5, total: 1200 },
  // already comfortably past the bar
  { key: "slasher", count: 90, total: 200 },
];

describe("titlesToSignature", () => {
  for (const { key, count, total } of CASES) {
    const k = titlesToSignature(key, { [key]: count }, total);

    it(`${key}: ${count}/${total} is ${k} short, and ${k} is enough`, () => {
      // Every added title is one of this theme, so both sides move together.
      expect(qualifies(key, count + k, total + k)).toBe(true);
    });

    it(`${key}: ${count}/${total} is not already there at ${k - 1}`, () => {
      if (k === 0) {
        expect(qualifies(key, count, total)).toBe(true);
        return;
      }
      // One short must genuinely fail, or the printed number is too high.
      expect(qualifies(key, count + k - 1, total + k - 1)).toBe(false);
    });
  }

  it("is zero once the theme already qualifies", () => {
    expect(titlesToSignature("slasher", { slasher: 90 }, 200)).toBe(0);
  });

  it("counts a theme with no titles at all", () => {
    expect(titlesToSignature("sport", {}, 200)).toBeGreaterThan(0);
  });
});
