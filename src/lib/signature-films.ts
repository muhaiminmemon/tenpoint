import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { CLUSTERS, CLUSTER_PREVALENCE } from "./archetype-clusters";
import type { TasteSignals } from "./taste-card-signals";

/**
 * The four films printed on the card, and why each one is there.
 *
 * They used to be the first four rows of the library, which is sorted by
 * rating. That reads like a top four and is not even that: a library with a
 * dozen tens breaks the tie alphabetically, so one account's card showed
 * 3 Idiots, Avengers, Ford v Ferrari and Harry Potter purely because those
 * sort first among the tens.
 *
 * A signature film should be one that could only be on *your* card. Highest
 * rated is the opposite of that: the top of everybody's list is the canon.
 *
 * So the four slots each do a different job, and diversity comes from that
 * structure rather than from a penalty term bolted onto one ranking. Each slot
 * also carries its own sentence, because four unlabelled posters cannot
 * explain themselves.
 */
export type SignatureFilm = {
  slug: string;
  title: string;
  posterPath: string | null;
  rating: number;
  /** which job this tile is doing */
  slot: SignatureSlot;
  /** the one line that says why this film and not another */
  reason: string;
};

export type SignatureSlot = "anchor" | "divergence" | "deepcut" | "regular" | "theme";

export const SLOT_LABELS: Record<SignatureSlot, string> = {
  anchor: "The anchor",
  divergence: "Yours more than theirs",
  deepcut: "The deep cut",
  regular: "The one you return to",
  theme: "The evidence",
};

export const SLOT_NOTES: Record<SignatureSlot, string> = {
  anchor: "The film you would name first: your highest conviction, and the one most people will know.",
  divergence: "Where you and the crowd disagree most, in your favour. A film everybody loves says less about you than one only you do.",
  deepcut: "The film you rate highly that almost nobody has rated at all.",
  regular: "The film you have gone back to most. Returning to something is a signature by definition.",
  theme: "The clearest evidence for the theme your card is named after.",
};

type Candidate = {
  slug: string;
  title: string;
  posterPath: string | null;
  rating: number;
  director: string | null;
  imdbRating: number | null;
  voteCount: number | null;
  viewings: number;
  /** the most specific theme this film belongs to, for keeping the four apart */
  primaryTheme: string | null;
  themes: Set<string>;
};

/**
 * Votes below which a low count means "nobody filled this in" rather than
 * "nobody has seen it". Two films in the test data carry zero, with no other
 * metadata either.
 */
const DEEP_CUT_FLOOR = 50;

/** Viewings that make a film a habit rather than a repeat. */
const REGULAR_VIEWINGS = 3;

export async function pickSignatureFilms(
  userId: string,
  signals: TasteSignals,
  themeKey: string | null,
  { includePrivate = false }: { includePrivate?: boolean } = {},
): Promise<SignatureFilm[]> {
  const privacy: SQL = includePrivate ? sql`true` : sql`private = false`;

  const rows = await db.execute(sql`
    with cur as (
      select distinct on (d.film_id) d.film_id, d.rating
      from diary_entries d
      where d.user_id = ${userId} and d.rating is not null and ${privacy}
      order by d.film_id, d.watched_on desc nulls last, d.created_at desc
    ),
    views as (
      select film_id, count(*)::int as n from diary_entries
      where user_id = ${userId} and ${privacy} group by film_id
    )
    select f.slug, f.title, f.poster_path, f.director, f.imdb_rating, f.vote_count,
           f.keywords, c.rating, coalesce(v.n, 1) as viewings
    from cur c
    join films f on f.id = c.film_id
    left join views v on v.film_id = c.film_id
    where f.poster_path is not null
  `);

  const candidates: Candidate[] = (rows as unknown as Record<string, unknown>[]).map((r) => {
    const held = new Set(
      (Array.isArray(r.keywords) ? (r.keywords as string[]) : []).map((k) => k.toLowerCase()),
    );
    const themes = new Set(
      CLUSTERS.filter((c) => c.keywords.some((k) => held.has(k))).map((c) => c.key),
    );
    // The rarest theme a film belongs to is the one that says most about it:
    // half the catalogue is an adventure, far less of it is a heist.
    const primaryTheme =
      [...themes].sort(
        (a, b) => (CLUSTER_PREVALENCE[a] ?? 1) - (CLUSTER_PREVALENCE[b] ?? 1),
      )[0] ?? null;

    return {
      slug: r.slug as string,
      title: r.title as string,
      posterPath: (r.poster_path as string) ?? null,
      rating: r.rating as number,
      director: (r.director as string) ?? null,
      imdbRating: (r.imdb_rating as number) ?? null,
      voteCount: (r.vote_count as number) ?? null,
      viewings: r.viewings as number,
      primaryTheme,
      themes,
    };
  });

  if (candidates.length === 0) return [];

  /**
   * Conviction, measured against your own scale rather than the ten-point one.
   *
   * A hard marker's 8.5 is the same statement as a generous rater's 9.5, and
   * a raw threshold would print one person's whole library and none of the
   * other's.
   */
  const mean = signals.mean ?? 70;
  const sd = signals.ratingStdDev && signals.ratingStdDev > 3 ? signals.ratingStdDev : 10;
  const z = (c: Candidate) => (c.rating - mean) / sd;

  // Under about ten films there is no spread worth measuring, so the old
  // behaviour is the honest one: the best of what little there is.
  if (candidates.length < 10) {
    return [...candidates]
      .sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title))
      .slice(0, 4)
      .map((c) => ({
        slug: c.slug,
        title: c.title,
        posterPath: c.posterPath,
        rating: c.rating,
        slot: "anchor" as const,
        reason: "One of your highest rated so far.",
      }));
  }

  const taken = new Set<string>();
  const usedDirectors = new Set<string>();
  const usedThemes = new Set<string>();
  const picks: SignatureFilm[] = [];

  /** A film may not repeat, and the four should not all be one director or one theme. */
  const free = (c: Candidate, strict = true) => {
    if (taken.has(c.slug)) return false;
    if (!strict) return true;
    if (c.director && usedDirectors.has(c.director)) return false;
    if (c.primaryTheme && usedThemes.has(c.primaryTheme)) return false;
    return true;
  };

  const take = (c: Candidate | undefined, slot: SignatureSlot, reason: string) => {
    if (!c) return false;
    taken.add(c.slug);
    if (c.director) usedDirectors.add(c.director);
    if (c.primaryTheme) usedThemes.add(c.primaryTheme);
    picks.push({
      slug: c.slug,
      title: c.title,
      posterPath: c.posterPath,
      rating: c.rating,
      slot,
      reason,
    });
    return true;
  };

  /**
   * Each slot looks for its own film, then relaxes rather than leaving a hole.
   *
   * First pass keeps the director and theme apart; second pass drops that
   * constraint, because a repeated director costs less than an empty tile.
   */
  const best = (
    pool: (strict: boolean) => Candidate[],
    pick: (list: Candidate[]) => Candidate | undefined,
  ) => pick(pool(true)) ?? pick(pool(false));

  const strong = (c: Candidate) => z(c) >= 0.5;

  // 1. the anchor: highest conviction, and among equals the one most people know
  const anchor = best(
    (s) => candidates.filter((c) => free(c, s)),
    (list) =>
      [...list].sort((a, b) => z(b) - z(a) || (b.voteCount ?? 0) - (a.voteCount ?? 0))[0],
  );
  if (anchor) {
    // Its own fact, not a restatement of the slot's job: the panel prints both
    // and two identical sentences read as a mistake.
    take(
      anchor,
      "anchor",
      `Rated ${(anchor.rating / 10).toFixed(1)}, the best known of the films you rate highest.`,
    );
  }

  // 2. the divergence: where you and the crowd part company, in your favour
  const gap = (c: Candidate) => (c.imdbRating === null ? -Infinity : c.rating - c.imdbRating);
  const diverged = best(
    (s) => candidates.filter((c) => free(c, s) && strong(c) && c.imdbRating !== null && gap(c) > 5),
    (list) => [...list].sort((a, b) => gap(b) - gap(a))[0],
  );
  if (diverged) {
    take(
      diverged,
      "divergence",
      `You rate it ${(gap(diverged) / 10).toFixed(1)} above the IMDb crowd.`,
    );
  }

  // 3. the deep cut: loved, and almost unrated anywhere
  const buried = best(
    (s) =>
      candidates.filter(
        (c) => free(c, s) && strong(c) && (c.voteCount ?? 0) >= DEEP_CUT_FLOOR,
      ),
    (list) => [...list].sort((a, b) => (a.voteCount ?? 0) - (b.voteCount ?? 0))[0],
  );
  if (buried) {
    take(
      buried,
      "deepcut",
      `Only ${(buried.voteCount ?? 0).toLocaleString()} people have rated this anywhere.`,
    );
  }

  // 4. the one you go back to, or failing that the evidence for your theme
  const regular = best(
    (s) => candidates.filter((c) => free(c, s) && c.viewings >= REGULAR_VIEWINGS),
    (list) => [...list].sort((a, b) => b.viewings - a.viewings || z(b) - z(a))[0],
  );
  if (regular) {
    take(regular, "regular", `You have watched this ${regular.viewings} times.`);
  } else if (themeKey) {
    const theme = CLUSTERS.find((c) => c.key === themeKey);
    const evidence = best(
      (s) => candidates.filter((c) => free(c, s) && c.themes.has(themeKey)),
      (list) => [...list].sort((a, b) => z(b) - z(a))[0],
    );
    if (evidence && theme) {
      take(evidence, "theme", `Your highest rated film about ${theme.note}.`);
    }
  }

  // Anything still empty is filled from one composite ranking, so a card is
  // never short a tile.
  if (picks.length < 4) {
    const norm = (v: number, max: number) => (max > 0 ? Math.min(1, v / max) : 0);
    const maxGap = Math.max(...candidates.map((c) => Math.max(0, gap(c))), 1);
    const maxViews = Math.max(...candidates.map((c) => c.viewings), 1);
    const composite = (c: Candidate) =>
      z(c) +
      0.8 * norm(Math.max(0, gap(c)), maxGap) +
      0.5 * (c.voteCount ? 1 - norm(Math.log10(c.voteCount + 1), 5) : 0) +
      0.4 * (themeKey && c.themes.has(themeKey) ? 1 : 0) +
      0.3 * norm(c.viewings, maxViews);

    for (const strict of [true, false]) {
      const rest = candidates
        .filter((c) => free(c, strict))
        .sort((a, b) => composite(b) - composite(a));
      for (const c of rest) {
        if (picks.length >= 4) break;
        take(c, "anchor", "One of the films your card is built from.");
      }
      if (picks.length >= 4) break;
    }
  }

  return picks.slice(0, 4);
}
