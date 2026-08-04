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
  /** what this particular film is here as, e.g. "The one nobody knows" */
  label: string;
  /** the one line that says why this film and not another */
  reason: string;
};

export type SignatureSlot = "anchor" | "portrait";

/**
 * Only the anchor has a fixed name. The other three are named for what they
 * turned out to be, because three tiles reading "The range" over three
 * identical explanations tells nobody anything about any of them.
 */
export const SLOT_LABELS: Record<SignatureSlot, string> = {
  anchor: "The anchor",
  portrait: "The range",
};

type Candidate = {
  slug: string;
  title: string;
  /** a season is rated exactly like a film, and can be signature exactly like one */
  kind: "movie" | "season";
  posterPath: string | null;
  rating: number;
  director: string | null;
  imdbRating: number | null;
  voteCount: number | null;
  /** how many people have rated it on IMDb: the least parochial count we hold */
  imdbVotes: number | null;
  viewings: number;
  reviews: number;
  /** the most specific theme this film belongs to, for keeping the four apart */
  primaryTheme: string | null;
  themes: Set<string>;
  year: number | null;
  language: string | null;
  /** position on the similarity map, when the background job has reached it */
  embedding: number[] | null;
  /** where this film sits in the library, as a vector the portrait compares */
  facets: number[];
};

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
      select film_id,
             count(*)::int as n,
             count(*) filter (where review is not null and length(trim(review)) > 0)::int as reviews
      from diary_entries
      where user_id = ${userId} and ${privacy} group by film_id
    )
    select f.slug, f.title, f.kind, f.poster_path, f.director, f.imdb_rating, f.vote_count,
           f.imdb_votes, f.keywords, f.year, f.original_language, f.embedding,
           c.rating, coalesce(v.n, 1) as viewings, coalesce(v.reviews, 0) as reviews
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
      kind: (r.kind as string) === "season" ? ("season" as const) : ("movie" as const),
      posterPath: (r.poster_path as string) ?? null,
      rating: r.rating as number,
      director: (r.director as string) ?? null,
      imdbRating: (r.imdb_rating as number) ?? null,
      voteCount: (r.vote_count as number) ?? null,
      imdbVotes: (r.imdb_votes as number) ?? null,
      viewings: r.viewings as number,
      reviews: r.reviews as number,
      primaryTheme,
      themes,
      year: (r.year as number) ?? null,
      language: (r.original_language as string) ?? null,
      embedding: Array.isArray(r.embedding) ? (r.embedding as number[]) : null,
      facets: [],
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
        label: "One of your best so far",
        reason: "Rate a few more and these start being chosen properly.",
      }));
  }

  /**
   * The portrait: four films that, seen alone, give the closest impression of
   * the whole library.
   *
   * A top four is a highlight reel, and the top of everybody's list is the
   * canon. This asks a different question. Describe the library as a vector of
   * proportions: how much of it is each of the themes it actually runs on, how
   * it splits across eras, how widely seen it is, how much of it is not in
   * English, how hard it is rated. Then choose the four films whose own average
   * lands closest to that vector.
   *
   * The result is a representative sample rather than a leaderboard. If a
   * stranger watched only these four, their impression of this person would be
   * as close to the truth as four films can get.
   *
   * Greedy rather than exhaustive: every subset of four from three hundred is
   * three hundred million combinations, and picking the film that closes the
   * most remaining distance, four times, lands within a percent or two of the
   * best possible set for a rounding error of the cost.
   */
  /**
   * How much this person actually loves a film, from whatever evidence exists.
   *
   * Rating is the only signal every library has, so it always counts. The
   * others are worth more than a rating when they are there and are simply
   * absent when they are not: nobody has rewatched anything three times yet,
   * and there is one review across every account. Rather than let those score
   * zero for everybody and drag the whole measure down, the weights are
   * renormalised over the signals this particular library actually carries. A
   * diary of pure ratings is judged entirely on ratings. The day somebody
   * starts rewatching, returning to a film begins to matter for them without
   * anything changing here.
   */
  const hasRewatches = candidates.some((c) => c.viewings >= 2);
  const hasReviews = candidates.some((c) => c.reviews > 0);

  const affection = (c: Candidate) => {
    const parts: [number, number][] = [
      // Conviction on their own scale, flattened above two standard deviations
      // because past that everybody is just at the top of their own range.
      [1, Math.max(0, Math.min(1, z(c) / 2))],
    ];
    if (hasRewatches) parts.push([0.55, Math.min(1, (c.viewings - 1) / 3)]);
    if (hasReviews) parts.push([0.3, c.reviews > 0 ? 1 : 0]);

    const total = parts.reduce((sum, [w]) => sum + w, 0);
    return parts.reduce((sum, [w, v]) => sum + w * v, 0) / total;
  };

  const themeKeys = [...new Set(candidates.flatMap((c) => [...c.themes]))].slice(0, 24);

  /**
   * The facets, in one flat vector so two sets can be compared with one
   * subtraction. Grouped weights keep twenty-four theme dimensions from
   * drowning out the four that describe era.
   */
  const facetsOf = (c: Candidate): number[] => {
    const era = [
      c.year !== null && c.year < 1970 ? 1 : 0,
      c.year !== null && c.year >= 1970 && c.year < 1990 ? 1 : 0,
      c.year !== null && c.year >= 1990 && c.year < 2010 ? 1 : 0,
      c.year !== null && c.year >= 2010 ? 1 : 0,
    ];
    const reach = [
      (c.imdbVotes ?? 0) >= 250_000 ? 1 : 0,
      (c.imdbVotes ?? 0) >= 50_000 && (c.imdbVotes ?? 0) < 250_000 ? 1 : 0,
      (c.imdbVotes ?? 0) > 0 && (c.imdbVotes ?? 0) < 50_000 ? 1 : 0,
    ];
    // Only what a film *is*. How somebody felt about it was in here once, and
    // it quietly wrecked the whole thing: the target then carried the library's
    // average rating, so the objective rewarded a set whose ratings averaged
    // out to the same middling number. On a shelf averaging 6.3 that meant
    // three sevens on the card. Affection belongs in the score, not the shape.
    return [
      ...themeKeys.map((k) => (c.themes.has(k) ? 1 : 0)),
      ...era,
      ...reach,
      c.language !== null && c.language !== "en" ? 1 : 0,
    ];
  };

  for (const c of candidates) c.facets = facetsOf(c);

  const DIMS = candidates[0].facets.length;
  // Themes are many and each is thin, so they are weighted down as a group;
  // era, reach, language and rating position are few and each carries more.
  const weights = candidates[0].facets.map((_, i) =>
    i < themeKeys.length ? 1 / Math.max(1, themeKeys.length) : 1,
  );

  /**
   * The shape of the library, weighted by how much of it is loved.
   *
   * An unweighted average is a picture of what somebody watched, and people
   * watch plenty for reasons that are not taste: a franchise finished out of
   * habit, a family film, a thing everyone was talking about. Weighting each
   * film by affection means the shape being matched is the library they care
   * about rather than the one they merely accumulated.
   */
  const target = new Array(DIMS).fill(0);
  let weightSum = 0;
  for (const c of candidates) {
    const w = 0.15 + affection(c);
    weightSum += w;
    for (let i = 0; i < DIMS; i++) target[i] += c.facets[i] * w;
  }
  for (let i = 0; i < DIMS; i++) target[i] /= Math.max(1e-9, weightSum);

  /** How far a chosen set's average sits from the library's own proportions. */
  const distance = (sum: number[], n: number) => {
    let d = 0;
    for (let i = 0; i < DIMS; i++) {
      const diff = sum[i] / n - target[i];
      d += weights[i] * diff * diff;
    }
    return Math.sqrt(d);
  };

  /**
   * What this film is doing here, said the way a person would say it.
   *
   * The facet it closed the most gap on, turned into a name and a plain
   * sentence. Only facets the film actually carries: a film with no 1970s in
   * it can close the 1970s gap by diluting a set that is over-weighted there,
   * and calling that one "the old one" would be a sentence about a film that
   * is nothing of the kind.
   */
  type Role = { label: string; plain: string };

  const roleFor = (c: Candidate, sum: number[], n: number): Role | null => {
    let bestIdx = -1;
    let bestGain = 0;
    for (let i = 0; i < DIMS; i++) {
      if (c.facets[i] <= 0) continue;
      const before = Math.abs(sum[i] / Math.max(1, n) - target[i]);
      const after = Math.abs((sum[i] + c.facets[i]) / (n + 1) - target[i]);
      const gain = (before - after) * weights[i];
      if (gain > bestGain) {
        bestGain = gain;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return null;

    if (bestIdx < themeKeys.length) {
      const cluster = CLUSTERS.find((x) => x.key === themeKeys[bestIdx]);
      if (!cluster) return null;
      // The subject in plain words rather than the theme's own name. "The
      // mythmaker" means nothing to somebody who has not read the binder;
      // "the one about magic" means the same thing to everybody.
      const subject = cluster.note.split(",")[0].split(" and ")[0].trim();
      return {
        label: `The one about ${subject}`,
        plain: `It is the only one of the four about ${cluster.note}.`,
      };
    }

    const rest = bestIdx - themeKeys.length;
    const votes = c.imdbVotes ?? 0;
    // Named for the decade the film is actually from. The bands are wide, and
    // a band label put a 2008 film under "the nineties".
    const decade = c.year !== null ? `the ${Math.floor(c.year / 10) * 10}s` : "its era";
    const roles: (Role | null)[] = [
      {
        label: `The one from ${decade}`,
        plain: "Hardly anything else you love was made this long ago.",
      },
      {
        label: `The one from ${decade}`,
        plain: "It holds down a stretch of film the rest of your favourites skip.",
      },
      {
        label: `The one from ${decade}`,
        plain: "The rest of these are either much older or much newer than it.",
      },
      { label: "The recent one", plain: "It is the newest thing you rate this highly." },
      {
        label: "The one everybody knows",
        plain: `${votes.toLocaleString()} people have rated it. It is the one everybody has in common.`,
      },
      {
        label: "The one people mention",
        plain: "Well known without being universal, which is where most of your shelf sits.",
      },
      {
        label: "The one almost nobody knows",
        plain: `Only ${votes.toLocaleString()} people have rated it anywhere. You are early on this.`,
      },
      {
        label: "The subtitled one",
        plain: "The only one of the four not made in English.",
      },
    ];
    return roles[rest] ?? null;
  };

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

  const take = (
    c: Candidate | undefined,
    slot: SignatureSlot,
    label: string,
    reason: string,
  ) => {
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
      label,
      reason,
    });
    return true;
  };



  // The anchor: highest conviction, and among equals the one most people know.
  // It seeds the portrait rather than competing with it.
  const anchor = [...candidates]
    .filter((c) => free(c))
    .sort((a, b) => z(b) - z(a) || (b.voteCount ?? 0) - (a.voteCount ?? 0))[0];
  if (anchor) {
    // Its own fact, not a restatement of the slot's job: the panel prints both
    // and two identical sentences read as a mistake.
    take(
      anchor,
      "anchor",
      "The anchor",
      anchor.viewings >= 3
        ? `You have been back to it ${anchor.viewings} times, more than anything else you rate this highly.`
        : `Rated ${(anchor.rating / 10).toFixed(1)}, the best known of the films you rate highest.`,
    );
  }

  /**
   * The remaining three, chosen to describe rather than to impress.
   *
   * The anchor is already on the card, so the portrait starts from it and asks
   * three times: of everything left, which single film pulls this set closest
   * to what the whole library actually looks like? A film only qualifies if it
   * is one this person genuinely rates, because a representative sample of
   * films you disliked is not a portrait of your taste.
   */
  const byslug = new Map(candidates.map((c) => [c.slug, c]));
  const sum = new Array(DIMS).fill(0);
  if (picks.length === 1) {
    const seeded = candidates.find((c) => c.slug === picks[0].slug);
    if (seeded) for (let i = 0; i < DIMS; i++) sum[i] += seeded.facets[i];
  }

  /**
   * The bar a film clears before it may appear at all.
   *
   * Their own top tenth, which is the only threshold that means the same thing
   * to a hard marker and a generous one. The old bar of a quarter of a standard
   * deviation admitted a hundred and twelve of one library's two hundred and
   * forty five films: at that point it is not a signature, it is a sample.
   *
   * On a thin shelf the tenth percentile is two or three films, too few to
   * choose four from, so it relaxes to three quarters of a deviation and takes
   * whichever bar admits enough to work with.
   */
  const sorted = [...candidates].map((c) => c.rating).sort((a, b) => a - b);
  const decile = sorted[Math.floor(sorted.length * 0.9)] ?? sorted[sorted.length - 1];
  const spreadFloor = mean + 0.75 * sd;
  const bar =
    sorted.filter((r) => r >= decile).length >= 8 ? decile : Math.min(decile, spreadFloor);
  const likeable = (c: Candidate) => c.rating >= bar;

  /**
   * Affection first, coverage second, sameness discouraged rather than banned.
   *
   * Coverage used to be the whole objective, which is how a film somebody
   * merely tolerated could earn a place by conveniently filling an era. Now
   * every film has to be one they love before coverage gets an opinion, and
   * coverage only decides between films that already deserve to be there.
   *
   * Repeats are penalised, not forbidden. Somebody whose four defining films
   * are all paranoid thrillers should be allowed four paranoid thrillers;
   * banning the second one makes the card more varied and less true.
   */
  const COVERAGE_WEIGHT = 0.6;
  const SAME_DIRECTOR = 0.25;
  const SAME_THEME = 0.15;

  /**
   * The sequel problem, which the other two rules do not catch.
   *
   * Measuring which pairs the theme buckets call unrelated but the similarity
   * map calls nearly identical turned up eleven, and every single one was a
   * franchise: Ice Age beside Ice Age: The Meltdown, Toy Story 2 beside
   * Toy Story 3, four Alvin and the Chipmunks films. Those pairs routinely
   * have different directors and different rarest themes, so nothing stopped
   * both landing on one card.
   *
   * That is the honest extent of what this buys. It was not, as I expected,
   * able to see that Whiplash and Black Swan are the same kind of film: it
   * scored them 0.48, below plenty of pairs with nothing in common. So it is
   * used for near-duplicates and nothing else, and films the background job
   * has not reached yet simply skip the check.
   */
  const NEAR_DUPLICATE = 0.75;
  const TOO_ALIKE = 0.7;
  const similarity = (a: number[] | null, b: number[] | null) => {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot;
  };

  while (picks.length < 4) {
    const before = picks.length === 0 ? Infinity : distance(sum, picks.length);
    let choice: Candidate | undefined;
    let choiceScore = -Infinity;

    for (const c of candidates) {
      if (taken.has(c.slug) || !likeable(c)) continue;
      const trial = sum.map((v, i) => v + c.facets[i]);
      const after = distance(trial, picks.length + 1);
      const gain = before === Infinity ? 0 : Math.max(0, before - after);

      let value = affection(c) + COVERAGE_WEIGHT * gain;
      if (c.director && usedDirectors.has(c.director)) value -= SAME_DIRECTOR;
      if (c.primaryTheme && usedThemes.has(c.primaryTheme)) value -= SAME_THEME;

      const closest = Math.max(
        0,
        ...picks.map((p) => similarity(c.embedding, byslug.get(p.slug)?.embedding ?? null)),
      );
      if (closest >= NEAR_DUPLICATE) value -= TOO_ALIKE * closest;

      if (value > choiceScore) {
        choiceScore = value;
        choice = c;
      }
    }
    if (!choice) break;

    const role = roleFor(choice, sum, picks.length);
    for (let i = 0; i < DIMS; i++) sum[i] += choice.facets[i];

    // Going back to something outranks anything the maths noticed: it is the
    // rarest evidence a diary produces and the one a person recognises fastest.
    if (choice.viewings >= 3) {
      take(
        choice,
        "portrait",
        "The one you go back to",
        `You have watched it ${choice.viewings} times. Almost nothing else on your shelf gets that.`,
      );
    } else if (choice.viewings === 2) {
      take(
        choice,
        "portrait",
        "The one you went back to",
        "You have watched it twice, which you hardly ever do.",
      );
    } else if (role) {
      take(choice, "portrait", role.label, role.plain);
    } else if (choice.reviews > 0) {
      take(
        choice,
        "portrait",
        "The one you wrote about",
        "You stopped to write something down after this one.",
      );
    } else {
      take(
        choice,
        "portrait",
        "Also yours",
        `Rated ${(choice.rating / 10).toFixed(1)}, and it widens what these four cover between them.`,
      );
    }
  }

  return balance(picks.slice(0, 4), candidates);
}

/**
 * Four picks that reflect what somebody actually watches.
 *
 * The portrait objective knows nothing about films against series, so a shelf
 * that is a quarter television would still put up four films: there are simply
 * more of them, so they win more slots. That is arithmetic, not a reading, and
 * it makes the card quietly wrong about a person.
 *
 * So the mix is enforced afterwards rather than built into the objective. The
 * share of the shelf that is series decides how many of the four are series,
 * rounded, and one of each is guaranteed once the smaller half is real rather
 * than incidental. A swap takes the weakest pick of the over-represented kind
 * and the strongest unused candidate of the other, which keeps the objective's
 * ordering intact inside each half.
 */
function balance(picks: SignatureFilm[], candidates: Candidate[]): SignatureFilm[] {
  const bySlug = new Map(candidates.map((c) => [c.slug, c]));
  const seasons = candidates.filter((c) => c.kind === "season");
  const movies = candidates.filter((c) => c.kind === "movie");
  if (seasons.length === 0 || movies.length === 0) return picks;

  const share = seasons.length / candidates.length;
  // Below three rated seasons a television habit is not established enough to
  // spend a quarter of somebody's card on.
  const floor = seasons.length >= 3 ? 1 : 0;
  const ceiling = movies.length >= 3 ? 3 : 4;
  const want = Math.min(ceiling, Math.max(floor, Math.round(share * picks.length)));

  const out = [...picks];
  const isSeason = (p: SignatureFilm) => bySlug.get(p.slug)?.kind === "season";
  const chosen = new Set(out.map((p) => p.slug));

  const swapOne = (from: "movie" | "season") => {
    // Weakest of the over-represented kind, by the rating that put it there.
    let worst = -1;
    for (let i = out.length - 1; i >= 0; i--) {
      const c = bySlug.get(out[i].slug);
      if (c && c.kind === from) { worst = i; break; }
    }
    const pool = (from === "movie" ? seasons : movies)
      .filter((c) => !chosen.has(c.slug))
      .sort((a, b) => b.rating - a.rating);
    if (worst < 0 || !pool[0]) return false;
    const c = pool[0];
    chosen.delete(out[worst].slug);
    chosen.add(c.slug);
    out[worst] = {
      ...out[worst],
      slug: c.slug,
      title: c.title,
      posterPath: c.posterPath,
      rating: c.rating,
      label: c.kind === "season" ? "The series you keep" : "The film you keep",
      reason:
        c.kind === "season"
          ? "Your shelf is part television, so one of these four is."
          : "Your shelf is mostly film, so this one holds a slot for it.",
    };
    return true;
  };

  let guard = 0;
  while (guard++ < 4) {
    const have = out.filter(isSeason).length;
    if (have === want) break;
    if (!swapOne(have > want ? "season" : "movie")) break;
  }
  return out;
}
