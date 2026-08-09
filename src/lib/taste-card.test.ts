import { describe, expect, it } from "vitest";
import { libraryDepth, tierFor, tierStanding, SEASON_WEIGHT } from "./taste-card";
import type { TasteSignals } from "./taste-card-signals";

/**
 * Depth is arithmetic over a handful of counters, so the fixture only has to
 * carry those. Everything else on `TasteSignals` is read by the archetype and
 * the traits, neither of which the ladder is allowed to touch.
 */
function signals(over: Partial<TasteSignals> = {}): TasteSignals {
  return {
    rated: 0,
    seasonCount: 0,
    wholeShowCount: 0,
    wholeShowOnlyCount: 0,
    completedShows: 0,
    completedBySeasons: 0,
    repeatTitleCount: 0,
    ...over,
  } as TasteSignals;
}

describe("library depth", () => {
  it("counts a film as one and a season as four", () => {
    const d = libraryDepth(signals({ rated: 12, seasonCount: 2 }));
    // 10 films + 2 seasons
    expect(d.depth).toBe(10 + 2 * SEASON_WEIGHT);
  });

  it("prints the arithmetic for every line", () => {
    const d = libraryDepth(signals({ rated: 5, seasonCount: 1 }));
    const seasons = d.lines.find((l) => l.key === "seasons")!;
    expect(seasons.count).toBe(1);
    expect(seasons.per).toBe(4);
    expect(seasons.points).toBe(4);
  });

  /**
   * The card that exposed this said "8 seasons", "32 whole series" and "24
   * series finished" at once. No reader could reconcile those, and underneath
   * the confusion the ladder was being paid twice: a whole-series rating bought
   * four points on its own line and then two more as a completion it had not
   * evidenced.
   */
  describe("a shelf rated mostly at the series level", () => {
    const elf = signals({
      rated: 579, // 539 films + 8 seasons + 32 whole-series rows
      seasonCount: 8,
      wholeShowCount: 32,
      // Of those 32, four also had a season rated individually.
      wholeShowOnlyCount: 28,
      // The old rule called 24 of them finished purely from the whole ratings.
      completedShows: 24,
      // Only one was actually finished season by season.
      completedBySeasons: 1,
      repeatTitleCount: 12,
    });

    it("never pays for the same series twice", () => {
      const d = libraryDepth(elf);
      const shows = d.lines.find((l) => l.key === "shows")!;
      // 28, not 32: the four with rated seasons are already on the seasons line.
      expect(shows.count).toBe(28);
    });

    it("does not award completion that no season evidences", () => {
      const d = libraryDepth(elf);
      const completed = d.lines.find((l) => l.key === "completed")!;
      expect(completed.count).toBe(1);
      expect(completed.points).toBe(2);
      // The old behaviour would have been 24 × 2 = 48.
      expect(completed.points).toBeLessThan(48);
    });

    it("adds up to exactly what the lines show", () => {
      const d = libraryDepth(elf);
      const summed = d.lines.reduce((n, l) => n + l.points, 0);
      expect(d.depth).toBe(summed);
    });
  });

  it("caps the bonuses so base volume always dominates", () => {
    const grinder = signals({
      rated: 100,
      completedBySeasons: 500,
      repeatTitleCount: 500,
    });
    const d = libraryDepth(grinder);
    const completed = d.lines.find((l) => l.key === "completed")!;
    const rewatched = d.lines.find((l) => l.key === "rewatched")!;
    expect(completed.points).toBe(50);
    expect(completed.capped).toBe(true);
    expect(rewatched.points).toBe(25);
    expect(rewatched.capped).toBe(true);
  });

  it("counts a title returned to many times only once", () => {
    // repeatTitleCount is distinct titles, so ten rewatches of one film is one.
    const d = libraryDepth(signals({ rated: 10, repeatTitleCount: 1 }));
    expect(d.lines.find((l) => l.key === "rewatched")!.points).toBe(1);
  });
});

describe("the ladder", () => {
  it("puts each threshold where it says it does", () => {
    expect(tierFor(0).name).toBe("Common");
    expect(tierFor(59).name).toBe("Common");
    expect(tierFor(60).name).toBe("Uncommon");
    expect(tierFor(200).name).toBe("Rare");
    expect(tierFor(500).name).toBe("Epic");
    expect(tierFor(1200).name).toBe("Legendary");
    expect(tierFor(2500).name).toBe("Mythic");
  });

  it("reports the distance to the next rung, not to the one after", () => {
    const s = tierStanding(signals({ rated: 250 }));
    expect(s.tier.name).toBe("Rare");
    expect(s.next?.name).toBe("Epic");
    expect(s.gate?.toNext).toBe(250);
  });

  it("has no gate at the top of the ladder", () => {
    const s = tierStanding(signals({ rated: 3000 }));
    expect(s.tier.name).toBe("Mythic");
    expect(s.next).toBeNull();
    expect(s.gate).toBeNull();
  });

  /** Rank must never be a reading of taste. */
  it("ignores breadth, reviews and genres entirely", () => {
    const narrow = libraryDepth(signals({ rated: 300 }));
    const broad = libraryDepth(
      signals({
        rated: 300,
        distinctGenres: 18,
        distinctDecades: 9,
        reviewCount: 400,
      } as Partial<TasteSignals>),
    );
    expect(broad.depth).toBe(narrow.depth);
  });
});
