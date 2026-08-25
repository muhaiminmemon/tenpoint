import { describe, expect, it } from "vitest";
import { needsRenumber, ratingFromNeighbours, sortKeyBetween } from "./placement";

/**
 * The one thing that must hold is that a gap can only ever be worth a rating
 * already on the scale. A 9.95 in the database is a corrupted record, and it
 * would arrive on screen looking entirely reasonable as "10.0".
 */
describe("ratingFromNeighbours", () => {
  it("has no answer with nothing either side", () => {
    expect(ratingFromNeighbours([], [])).toBeNull();
  });

  it("reads a gap inside a run of tens as a ten", () => {
    expect(ratingFromNeighbours([100, 100], [100, 100])).toBe(100);
  });

  it("averages the four around the gap", () => {
    // 9.1, 9.0 above; 8.8, 8.7 below
    expect(ratingFromNeighbours([91, 90], [88, 87])).toBe(89);
  });

  it("works at the top of the list, where there is nothing above", () => {
    expect(ratingFromNeighbours([], [88, 86])).toBe(87);
  });

  it("works at the bottom, where there is nothing below", () => {
    expect(ratingFromNeighbours([44, 40], [])).toBe(42);
  });

  it("ignores anything past the two nearest on each side", () => {
    // the 1.0s further down must not drag the gap away from the tens
    expect(ratingFromNeighbours([100, 100, 10], [100, 100, 10])).toBe(100);
  });

  it("always lands on a whole tenth", () => {
    for (let a = 10; a <= 100; a++) {
      for (let b = 10; b <= 100; b++) {
        const r = ratingFromNeighbours([a, a], [b, b])!;
        expect(Number.isInteger(r)).toBe(true);
      }
    }
  });

  it("never lands outside the neighbours it read", () => {
    for (let a = 10; a <= 100; a++) {
      for (let b = 10; b <= a; b++) {
        const r = ratingFromNeighbours([a, a], [b, b])!;
        expect(r).toBeLessThanOrEqual(a);
        expect(r).toBeGreaterThanOrEqual(b);
      }
    }
  });
});

describe("sortKeyBetween", () => {
  it("splits the gap between two neighbours", () => {
    expect(sortKeyBetween(1, 2)).toBe(1.5);
  });

  it("goes before the first when there is nothing above", () => {
    expect(sortKeyBetween(null, 5)).toBeLessThan(5);
  });

  it("goes after the last when there is nothing below", () => {
    expect(sortKeyBetween(5, null)).toBeGreaterThan(5);
  });
});

describe("needsRenumber", () => {
  it("is false while the band still has room", () => {
    expect(needsRenumber(1, 2)).toBe(false);
  });

  it("is true for a band nobody has ever ordered, where every key is zero", () => {
    expect(needsRenumber(0, 0)).toBe(true);
  });

  it("is true once halving has run the gap out", () => {
    expect(needsRenumber(1, 1 + 1e-9)).toBe(true);
  });
});
