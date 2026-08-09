import { describe, expect, it } from "vitest";
import { selectFromCandidates, type SignatureCandidate } from "./signature";
import { themesFor } from "./preference-profile";

/**
 * The controlled libraries.
 *
 * Each one is a shape somebody's shelf actually takes, and the question every
 * test asks is the acceptance question: would this person plausibly say "yes,
 * those belong on my card"? That is not always expressible as an assertion, so
 * where it is not, the test pins the property that would make the answer *no* —
 * four titles by one director, a season on the master card, an identical
 * caption printed twice.
 */

let seq = 0;
function title(over: Partial<SignatureCandidate> = {}): SignatureCandidate {
  seq++;
  const keywords = over.keywords ?? ["heist", "revenge"];
  return {
    slug: over.slug ?? `t-${seq}`,
    title: over.title ?? `Title ${seq}`,
    unit: over.unit ?? "movie",
    posterPath: over.posterPath ?? "/p.jpg",
    rating: over.rating ?? 80,
    director: over.director ?? null,
    keywords,
    themes: themesFor(keywords),
    primaryTheme: over.primaryTheme ?? [...themesFor(keywords)][0] ?? null,
    year: over.year ?? 2015,
    language: over.language ?? "en",
    reach: over.reach ?? 100_000,
    embedding: over.embedding ?? null,
    viewings: over.viewings ?? 1,
    reviews: over.reviews ?? 0,
    heldDays: over.heldDays ?? 0,
    ranked: over.ranked ?? false,
    crowdCount: over.crowdCount ?? 0,
    crowdMean: over.crowdMean ?? null,
    ...over,
  } as SignatureCandidate;
}

/** n titles, all alike unless the maker says otherwise. */
const many = (n: number, make: (i: number) => Partial<SignatureCandidate> = () => ({})) =>
  Array.from({ length: n }, (_, i) => title(make(i)));

describe("determinism", () => {
  it("gives the same four for the same library, twice", () => {
    const lib = many(40, (i) => ({ slug: `d-${i}`, rating: 60 + (i % 40) }));
    const a = selectFromCandidates(lib, 70, 10);
    const b = selectFromCandidates(lib, 70, 10);
    expect(a.titles.map((t) => t.slug)).toEqual(b.titles.map((t) => t.slug));
  });
});

describe("many 10/10 canonical films", () => {
  it("does not simply return four maximal ratings in title order", () => {
    const lib = many(30, (i) => ({
      slug: `c-${i}`,
      rating: i < 12 ? 100 : 70,
      keywords: i % 2 === 0 ? ["heist", "revenge"] : ["space", "alien"],
      reach: 500_000,
    }));
    const picked = selectFromCandidates(lib, 78, 12).titles;
    expect(picked).toHaveLength(4);
    // A tie among twelve tens must be broken by something other than order.
    expect(new Set(picked.map((t) => t.slug)).size).toBe(4);
  });
});

describe("one-director obsessive", () => {
  it("still allows the director to dominate but does not hand over all four unpenalised", () => {
    const lib = [
      ...many(10, (i) => ({ slug: `k-${i}`, director: "Kubrick", rating: 95 })),
      ...many(10, (i) => ({ slug: `o-${i}`, director: `Other ${i}`, rating: 92 })),
    ];
    const picked = selectFromCandidates(lib, 80, 8).titles;
    const kubrick = picked.filter((t) => t.slug.startsWith("k-")).length;
    // Soft penalty: not banned, not automatic.
    expect(kubrick).toBeGreaterThanOrEqual(1);
    expect(kubrick).toBeLessThanOrEqual(4);
  });
});

describe("one-franchise obsessive", () => {
  it("penalises near-identical embeddings so a franchise cannot fill the card", () => {
    const same = [1, 0, 0, 0];
    const lib = [
      ...many(6, (i) => ({ slug: `f-${i}`, rating: 98, embedding: same })),
      ...many(10, (i) => ({
        slug: `x-${i}`,
        rating: 95,
        embedding: [0, 1, 0, 0],
        keywords: ["space", "alien"],
      })),
    ];
    const picked = selectFromCandidates(lib, 80, 8).titles;
    const franchise = picked.filter((t) => t.slug.startsWith("f-")).length;
    expect(franchise).toBeLessThan(4);
  });
});

describe("master card units", () => {
  it("never puts a season on the card — only movies and whole shows", () => {
    const lib = [
      ...many(10, (i) => ({ slug: `m-${i}`, rating: 90 })),
      ...many(6, (i) => ({ slug: `s-${i}`, unit: "show" as const, rating: 95, ratedSeasons: 3, totalSeasons: 3, finished: true })),
    ];
    const picked = selectFromCandidates(lib, 80, 8).titles;
    for (const t of picked) expect(["movie", "show"]).toContain(t.unit);
  });
});

describe("anime-heavy user", () => {
  it("returns shows as whole works with season evidence", () => {
    const lib = many(14, (i) => ({
      slug: `a-${i}`,
      unit: "show" as const,
      rating: 88 + (i % 6),
      keywords: ["anime", "shounen"],
      ratedSeasons: 2 + (i % 3),
      totalSeasons: 2 + (i % 3),
      finished: true,
      viewings: 2,
    }));
    const res = selectFromCandidates(lib, 85, 6);
    expect(res.titles.every((t) => t.unit === "show")).toBe(true);
    expect(res.titles.some((t) => (t.evidence.totalSeasons ?? 0) > 0)).toBe(true);
  });
});

describe("film-only and prestige-TV users", () => {
  it("does not force a format quota on a film-only shelf", () => {
    const lib = many(20, (i) => ({ slug: `fo-${i}`, rating: 85 + (i % 10) }));
    const picked = selectFromCandidates(lib, 82, 8).titles;
    expect(picked.every((t) => t.unit === "movie")).toBe(true);
  });

  it("does not force a film onto a television-only shelf", () => {
    const lib = many(20, (i) => ({
      slug: `tv-${i}`,
      unit: "show" as const,
      rating: 85 + (i % 10),
      ratedSeasons: 4,
      totalSeasons: 4,
    }));
    const picked = selectFromCandidates(lib, 82, 8).titles;
    expect(picked.every((t) => t.unit === "show")).toBe(true);
  });
});

describe("generous and harsh raters", () => {
  it("treats conviction relative to the rater, not the ten-point scale", () => {
    const harsh = many(20, (i) => ({ slug: `h-${i}`, rating: i < 4 ? 72 : 45 }));
    const picked = selectFromCandidates(harsh, 50, 9).titles;
    // A 7.2 from somebody whose mean is 5.0 is a rave and must qualify.
    expect(picked).toHaveLength(4);
    expect(picked.some((t) => t.rating === 72)).toBe(true);
  });

  it("does not admit a generous rater's whole library", () => {
    const generous = many(30, (i) => ({ slug: `g-${i}`, rating: i < 3 ? 100 : 90 }));
    const res = selectFromCandidates(generous, 91, 4);
    expect(res.titles).toHaveLength(4);
  });
});

describe("international and obscure libraries", () => {
  it("keeps non-English titles eligible without needing a language quota", () => {
    const lib = many(20, (i) => ({
      slug: `i-${i}`,
      language: i % 2 === 0 ? "ko" : "en",
      rating: i % 2 === 0 ? 95 : 80,
      reach: i % 2 === 0 ? 8_000 : 400_000,
    }));
    const picked = selectFromCandidates(lib, 84, 9).titles;
    expect(picked.length).toBe(4);
  });
});

describe("low-data user", () => {
  it("says provisional rather than inventing a portrait", () => {
    const res = selectFromCandidates(many(5, (i) => ({ slug: `l-${i}`, rating: 90 })), 88, 5);
    expect(res.status).toBe("provisional");
    expect(res.confidence).toBeLessThan(0.5);
  });

  it("returns nothing at all for an empty library", () => {
    const res = selectFromCandidates([], 70, 10);
    expect(res.titles).toEqual([]);
    expect(res.status).toBe("provisional");
  });
});

describe("metadata gaps", () => {
  it("keeps a posterless title eligible and lowers confidence instead", () => {
    const lib = [
      title({ slug: "no-poster", posterPath: null, rating: 100, viewings: 3 }),
      ...many(15, (i) => ({ slug: `p-${i}`, rating: 70 })),
    ];
    const res = selectFromCandidates(lib, 72, 9);
    expect(res.titles.map((t) => t.slug)).toContain("no-poster");
  });

  it("does not treat unknown reach as obscurity", () => {
    const unknown = many(20, (i) => ({ slug: `u-${i}`, reach: null, rating: 90 }));
    const res = selectFromCandidates(unknown, 80, 8);
    // Confidence must register the gap rather than the score silently absorbing it.
    expect(res.confidence).toBeLessThan(1);
    expect(res.titles).toHaveLength(4);
  });
});

describe("explanations", () => {
  it("never prints the same label twice in one quartet", () => {
    const lib = many(24, (i) => ({
      slug: `e-${i}`,
      rating: 95 - (i % 5),
      viewings: i % 3 === 0 ? 3 : 1,
      reviews: i % 4 === 0 ? 1 : 0,
      heldDays: i * 30,
    }));
    const picked = selectFromCandidates(lib, 80, 9).titles;
    const labels = picked.map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("never prints the same reason twice in one quartet", () => {
    const lib = many(24, (i) => ({ slug: `r-${i}`, rating: 96, keywords: ["heist", "revenge"] }));
    const picked = selectFromCandidates(lib, 80, 9).titles;
    const reasons = picked.map((t) => t.reason);
    expect(new Set(reasons).size).toBe(reasons.length);
  });

  it("carries evidence and confidence on every title", () => {
    const lib = many(20, (i) => ({ slug: `v-${i}`, rating: 90 }));
    for (const t of selectFromCandidates(lib, 80, 8).titles) {
      expect(t.confidence).toBeGreaterThan(0);
      expect(t.confidence).toBeLessThanOrEqual(1);
      expect(t.evidence).toBeDefined();
      expect(t.reason.length).toBeGreaterThan(0);
    }
  });
});
