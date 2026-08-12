import { describe, expect, it } from "vitest";
import { __testables } from "@/components/RatingChips";

const { byPerson, ratedSummary, longPart, shortPart } = __testables;

const mk = (part: string | null, partSort: number | null, rating: number, watchedOn = "2026-01-01") => ({
  id: Math.random().toString(36), rating, username: "kai", displayName: "Kai Okafor",
  avatarUrl: null, part, partSort, watchedOn,
});

describe("whole-series ratings", () => {
  it("keeps the whole-series row as its own run, ahead of the seasons", () => {
    const [p] = byPerson([
      mk("season 2", 2, 85), mk("the whole series", -1, 90), mk("season 1", 1, 80),
    ]);
    expect(p.runs.map((r) => r.part)).toEqual(["the whole series", "season 1", "season 2"]);
    expect(p.runs[0].ratings[0].rating).toBe(90);
  });

  it("labels it without the article", () => {
    expect(longPart("the whole series")).toBe("Whole series");
    expect(longPart("the specials")).toBe("Specials");
    expect(longPart("season 4")).toBe("Season 4");
    expect(shortPart("the whole series", -1)).toBe("series");
  });

  it("counts seasons and the whole series separately", () => {
    const [p] = byPerson([mk("season 1", 1, 80), mk("season 2", 2, 85), mk("the whole series", -1, 90)]);
    expect(ratedSummary(p.runs)).toBe("Rated 2 seasons and the whole series.");
  });

  it("names the specials too", () => {
    const [p] = byPerson([mk("season 1", 1, 80), mk("the specials", 0, 70), mk("the whole series", -1, 90)]);
    expect(ratedSummary(p.runs)).toBe("Rated 1 season, the specials and the whole series.");
  });

  it("reports a whole-series rewatch as viewings, not seasons", () => {
    const [p] = byPerson([
      mk("the whole series", -1, 80, "2024-02-01"), mk("the whole series", -1, 95, "2026-02-01"),
    ]);
    expect(p.runs).toHaveLength(1);
    expect(p.runs[0].ratings.map((r) => r.rating)).toEqual([80, 95]);
    expect(ratedSummary(p.runs)).toBe("Rated the whole series, across 2 viewings.");
  });

  it("a film says nothing about seasons", () => {
    const [p] = byPerson([mk(null, null, 91)]);
    expect(ratedSummary(p.runs)).toBe("Rated once.");
  });
});
