# Stage 0 — Taste Card system audit

No code changed. Every claim below carries a `file:line`. Where this audit
disagrees with the brief that commissioned it, the code won.

---

## A. Current architecture

```
diary_entries (one row per viewing, rating in tenths)
        │
        ├──────────────────────────────────────────────┐
        ▼                                              ▼
getTasteProfile()                            getTasteSignals()
src/lib/taste.ts:40                          src/lib/taste-card-signals.ts:190
 mean, rated, topGenres,                      ~90 scalar counters, 5 band
 topDecade, library shape                     tuples, cluster counts
        │                                              │
        └───────────────────┬──────────────────────────┘
                            ▼
                   buildHomeTasteCard()
                   src/lib/taste.ts:618
                            │
   ┌────────────┬───────────┼────────────┬──────────────┬────────────┐
   ▼            ▼           ▼            ▼              ▼            ▼
tierStanding  computeVariant readArchetype evaluateTraits computePersonality
 :715          :718          :729          :739           (taste.ts:459)
   │            │             │              │
   │            │             └─ themeKey ──▶ pickSignatureFilms()
   │            │                (DEAD, see E)  src/lib/signature-films.ts:74
   ▼            ▼                                       │
 users.tier   variant.name                              ▼
 (syncUserTier :811)  → held_variants           4 × SignatureFilm
```

Consumers, all reading the same builder (good):

| Surface | Entry point |
|---|---|
| Home card | `src/app/page.tsx` → `buildHomeTasteCard` |
| Profile card | `src/app/[username]/page.tsx` |
| Share image | `src/app/api/card/[username]/route.tsx:84` → `buildHomeTasteCard` |
| Binder | `src/lib/binder.ts:103` `loadBinder` |
| Nav badge | `users.tier` via `syncUserTier` (`src/lib/taste.ts:811`) |

The share-card route does **not** recreate any calculation. That is the one
place the "same calculation, same explanation" principle already holds.

---

## B. Data model

| Table | Role in taste |
|---|---|
| `diary_entries` | source of truth. `rating` smallint tenths, nullable. `private`, `rewatch`, `review` |
| `films` | `kind` ∈ `movie` \| `season` \| `show`; `show_id`, `season_number`; `keywords`, `genres`, `cast_names`, `director`, `year`, `runtime`, `original_language`, `embedding`, `poster_path`, `imdb_votes`, `vote_count`, `imdb_rating`, `rt_score` |
| `shows` | `form` ∈ `anime` \| `animation` \| `live_action`; `status`; groups seasons |
| `users` | `tier`, `tier_seen`, `pinned_plate` |
| `held_variants` | finish history for the binder |

"Current rating" is everywhere defined as
`distinct on (film_id) … order by film_id, watched_on desc nulls last, created_at desc`.
That definition is copy-pasted into **four** separate SQL bodies
(`taste-card-signals.ts:197`, `:547`, `signature-films.ts:83`, `series-progress.ts:63`).
It is consistent today; nothing enforces that.

---

## C. Single sources of truth (what is already right)

- **Rating → current rating.** One semantic, four copies, currently identical.
- **Tier definition.** `RARITY_TIERS` (`taste-card.ts:41`) is the only tier table.
- **Gate + display.** `tierStanding` (`taste-card.ts:270`) returns both the tier
  and the reason, so the card cannot advertise a gate that is not in force.
- **Archetype text.** Card and binder both call `readArchetype`
  (`taste.ts:729`, `binder.ts:146`) rather than rebuilding the words.
- **Theme ontology.** `CLUSTERS` (50 entries, `archetype-clusters.ts:66`) is the
  only theme list.

## D. Duplicate / divergent calculations

| # | What | Where | Consequence |
|---|---|---|---|
| D1 | **Reach / popularity** computed three incompatible ways | signals `coalesce(imdb_votes, vote_count*50)` (`taste-card-signals.ts:213`); Signature `imdbVotes ?? 0` (`signature-films.ts:234`); anchor tiebreak uses TMDB `voteCount` (`signature-films.ts:408`) | The same film is "widely seen" on the personality axis and "almost nobody knows" on the Signature caption |
| D2 | **Reach banding** 4 bands vs 3 bands | `taste-card-signals.ts:396-399` vs `signature-films.ts:233-237` | Different cut points, different stories |
| D3 | **Theme extraction** with and without stoplist | `taste-card-signals.ts:562-564` applies `KEYWORD_STOPLIST`; `signature-films.ts:106-108` does not | Same title, different themes in Archetype vs Signature |
| D4 | **Rank input derivation** restated three times | `taste.ts:696`+`:715`, `binder.ts:124`, `taste.ts:819` | Any change must be made in three places |
| D5 | **Season weight** applied twice, differently | ladder uses `seasonFloor` ≈ ¼ film floor (`taste-card.ts:41-128`); milestone "titles logged" counts a season as **1** (`taste-card.ts:182`) | Two season weights inside the same promotion gate |
| D6 | **Privacy scope** differs per surface | `syncUserTier` forces `includePrivate: true` (`taste.ts:813`); binder uses `!thirdPerson` (`binder.ts:117`) | Persisted `users.tier` (nav badge) can outrank the tier a visitor sees |

## E. Dead parameters and dead code

| Symbol | Location | Status |
|---|---|---|
| `themeKey` param | `signature-films.ts:77` | **Accepted, never referenced in the body.** Fake API contract |
| `SLOT_LABELS` | `signature-films.ts:44` | Exported; **zero references anywhere**, including its own file |
| `weightedSize()` | `taste-card.ts:341` | **Zero callers.** Its own doc says the ladder no longer uses it; `balance()` uses `SEASON_WEIGHT` directly |
| `free(c, strict)` | `signature-films.ts:372` | `strict` never passed `false` — one call site (`:407`) |
| `CLUSTER_KEYWORDS` | `archetype-clusters.ts:470` | Zero external references |
| `SignatureSlot = "portrait"` label | `signature-films.ts:47` | Every portrait pick overwrites the label; `"The range"` never renders |
| 36 archetype nouns | `ARCHETYPE_NOUNS` (`taste-card.ts:516`) | See H4 — unreachable |
| `computeTier(rated, signals)` | `taste-card.ts:346` | Two-branch function; the signals branch passes `seasons = 0` (`:354`). Only ever called as `computeTier(0)` (`taste.ts:650`), so the bug is **latent, not live** |

## F. Stale comments

| Comment | Location | Reality |
|---|---|---|
| "TRAITS — eighteen" | `taste-card.ts:1206` | **27** entries in `TRAIT_DEFS` |
| "any three of five" | `taste-card.ts:10` | 5 is correct in code; **PRODUCT.md says "any three of six"** and is the stale one |
| "the last slot falls back to the theme the title is named after" | `taste.ts:734` | `themeKey` is ignored by the callee |
| "Weakest of the over-represented kind, by the rating that put it there" | `signature-films.ts:605` | Selects the **last-positioned** pick, not the weakest |
| "Grouped weights keep twenty-four theme dimensions from drowning out the four that describe era" | `signature-films.ts:223` | Inverted — era/reach/language outweigh **all** themes 8:1 (see I7) |

## G. Metadata dependencies (identity leaks)

| Field | Missing ⇒ | Location |
|---|---|---|
| `poster_path` | **Title excluded from identity entirely** | `signature-films.ts:102` |
| `imdb_votes` | Zero on **all three** reach dimensions — reads as "no reach", not "unknown" | `signature-films.ts:234-236` |
| `embedding` | Near-duplicate protection silently skipped | `signature-films.ts:491-493` |
| `keywords` | No themes; title still a candidate, contributes an all-zero theme block | `signature-films.ts:106` |
| `year` / `runtime` / `director` / `vote_count` | **Handled correctly** — signals carry explicit `*KnownCount` denominators | `taste-card-signals.ts:37-44`, `:74` |

The signals layer already does the right thing with unknowns. Signature Films
does not, and it is the surface that names titles out loud.

## H. Show / anime inconsistencies

- **H1 — `kind = 'show'` rows are coerced to movies.**
  `signature-films.ts:122`: `kind: r.kind === "season" ? "season" : "movie"`.
  A whole-series row therefore enters the pool as a *film*, can take a Signature
  slot, and is counted on the film side of `balance()` (`:584-585`). The end-goal
  spec says the Master Card signature unit is *movie or whole show*; today it is
  *movie or season*, with whole-shows mislabelled as movies.
- **H2 — series representative row is nondeterministic.**
  `taste-card-signals.ts:271`: `select distinct on (show_id) * from cur_f … order by show_id`.
  No tiebreaker after `show_id`, so *which* season supplies the series' genres,
  cast and director is arbitrary and can change between runs. Everything built on
  `cur_work` — genre counts, cast lift, director lift, genre-tagged denominator —
  inherits that.
- **H3 — anime is read from one field only.** `shows.form = 'anime'` feeds exactly
  one counter (`animeSeasonCount`, `taste-card-signals.ts:441`) and one trait.
  Anime does not otherwise reach the archetype, themes or Signature selection —
  which satisfies "no separate anime universe", but also means the anime audience
  currently gets no anime-aware reading at all.
- **H4 — 36 unreachable archetype nouns, exactly as suspected.**
  `ARCHETYPE_NOUNS` = 18 genres × 6 families = 108. `FAMILY_BY_GENRE` only ever
  emits `scale`, `shadow`, `warmth`, `wonder` — never `vintage` or `foreign`.
  18 × 2 = **36 nouns can never be produced.**
- **H5 — whole-show rating credits every season toward rank.**
  `show_credit` (`taste-card-signals.ts:243-256`) takes
  `greatest(rated_seasons, total_seasons when whole > 0)`. Rating one long series
  as a whole adds N seasons ≈ 4N film-equivalents to the ladder from a single
  action. Documented and intentional, but it is the largest rank lever in the
  product.

---

## I. Signature Films — exact pipeline

`pickSignatureFilms(userId, signals, themeKey, {includePrivate})` — `signature-films.ts:74`

1. **Candidate query** (`:82-103`). Current rating per film, joined to `films`,
   `where f.poster_path is not null`. **No `ORDER BY` on the outer select.**
2. **Theme tagging** (`:106-117`). Keywords lowercased, **no stoplist**. Themes =
   clusters sharing any keyword. `primaryTheme` = **rarest** matched theme by
   `CLUSTER_PREVALENCE` — rare ≠ central.
3. **Under-10 short circuit** (`:155-167`). Top 4 by rating, alphabetical tiebreak,
   all four labelled `"One of your best so far"` with an **identical** reason and
   `slot: "anchor"` on all four.
4. **Affection** (`:203-217`). Weighted mean of rating-conviction z, rewatch,
   review. `hasRewatches` / `hasReviews` are **library-global flags** — one
   rewatch anywhere switches the rewatch term on for *every* title.
5. **Facet space** (`:219`). `themeKeys = [...new Set(candidates.flatMap(themes))].slice(0, 24)`
   — the **first 24 encountered**, over the unordered result of step 1. Theme
   space is arbitrary *and* run-to-run unstable.
6. **Facet vector** (`:226-249`). 24 theme + 4 era + 3 reach + 1 non-English.
7. **Weights** (`:256-258`). Each theme dim gets `1/24`; every other dim gets `1`.
   All themes together = **1.0**; era + reach + language = **8.0**. The portrait is
   dominated by era, popularity and language, not by what the films are about.
8. **Target** (`:269-276`). Affection-weighted mean over **all** candidates.
9. **Anchor** (`:406-419`). Highest conviction, tiebreak **TMDB `voteCount`** —
   among many 10.0s the most famous wins.
10. **Bar** (`:450-455`). Top decile, relaxing to `mean + 0.75σ` on thin shelves.
11. **Greedy 2-4** (`:498-562`). `affection + 0.6 × coverageGain − 0.25 sameDirector
    − 0.15 sameTheme − 0.7 × cosine when ≥ 0.75`. **Target from all candidates,
    selection from the top decile** — the objective is aimed at a distribution the
    candidate set cannot represent.
12. **Captions** (`:299-364`, `:531-561`). Rewatch/review captions **override** the
    computed role. Overclaims: `"Only N people have rated it anywhere"` is
    IMDb-only (`:356`); `"The subtitled one"` is inferred from
    `original_language`, not from how it was watched (`:359`).
13. **`balance()`** (`:582-639`). Runs **after** optimisation.
    - `swapOne` scans `for (i = out.length-1; i--)` and takes the **first match
      from the end** — the last-positioned pick of that kind, not the weakest
      (`:605-609`).
    - Replacement pool sorted by **raw rating** (`:612`), discarding affection,
      coverage and every redundancy penalty.
    - The replaced entry keeps the old `slot` but gets a generic label/reason
      (`:617-628`).
    - It can replace the **anchor** if the anchor is the only pick of the
      over-represented kind.

## J. Rank — exact pipeline

1. `mix.films = taste.rated − seasonCount − wholeShowCount`;
   `mix.seasons = seasonsCredited` (`taste.ts:695-713`).
2. `ladderProgress = films/floor + seasons/seasonFloor` (`taste-card.ts:266`);
   `byCount` = highest tier where progress ≥ 1.
3. `milestonesAt(byCount.index, signals)` — 5 conditions: titles, genres, decades,
   reviews, rewatches (`taste-card.ts:168-207`).
4. **3 of 5 promotes exactly one rung**, never two (`taste-card.ts:280`).
5. `syncUserTier` persists `users.tier` with `includePrivate: true` (`taste.ts:811`).

Rank therefore depends on: rated count, season credit, genre breadth, decade
breadth, review count, rewatch count. Three of those five are **behavioural
achievements**, which is precisely the Rank/Confidence conflation the redesign
sets out to separate.

## K. Migration risks

1. **Everyone's rank moves** if season credit, milestones or thresholds change.
   `users.tier` + `tier_seen` drive a nav badge; a downward move is deliberately
   not flagged (`taste.ts:839`), so silent demotions are invisible but real.
2. **`held_variants` is append-only history.** Changing `computeVariant` mappings
   orphans finishes people already hold and the binder renders them as history.
3. **Binder plates are named after current tiers/finishes.** Renaming a tier or a
   stock breaks the pinned-plate record (`users.pinned_plate`).
4. **Fixing the theme stoplist divergence will change archetypes** for existing
   users — the noun comes from cluster counts.
5. **Signature output is currently unstable across runs**, so a "before/after"
   diff cannot be trusted until determinism lands. **Fix ordering first or you
   cannot measure anything else.**

---

# Ranked problem list

## P0 — correctness / determinism (Stage 1 scope)

| # | Problem | File · function |
|---|---|---|
| P0-1 | Candidate query has no outer `ORDER BY`; identity depends on Postgres row order | `signature-films.ts:82` `pickSignatureFilms` |
| P0-2 | Facet space = first 24 themes encountered, over that unordered set | `signature-films.ts:219` |
| P0-3 | Signature theme extraction skips `KEYWORD_STOPLIST`; Archetype applies it | `signature-films.ts:106` vs `taste-card-signals.ts:562` |
| P0-4 | Missing `imdb_votes` ⇒ 0 on all reach bands; canonical fallback `coalesce(imdb_votes, vote_count*50)` not used | `signature-films.ts:234` |
| P0-5 | `themeKey` accepted and ignored; caller comment claims it is used | `signature-films.ts:77`, `taste.ts:734` |
| P0-6 | `balance()` removes last-positioned, not weakest; re-picks by raw rating; can overwrite the anchor | `signature-films.ts:582-639` |
| P0-7 | `kind='show'` rows silently classified as `movie` | `signature-films.ts:122` |
| P0-8 | Series representative row nondeterministic (`distinct on` without tiebreaker) | `taste-card-signals.ts:271` |
| P0-9 | Under-10 path emits four identical explanations and mislabels all four `anchor` | `signature-films.ts:155-167` |
| P0-10 | No-poster titles excluded from identity computation, not just from rendering | `signature-films.ts:102` |
| P0-11 | `hasRewatches`/`hasReviews` global ⇒ one rewatch changes every title's affection | `signature-films.ts:203-204` |
| P0-12 | Persisted tier uses private entries; displayed tier may not | `taste.ts:813` vs `binder.ts:117` |

## P1 — product model

| # | Problem | File |
|---|---|---|
| P1-1 | Target built over all candidates, selection over top decile | `signature-films.ts:271` vs `:455` |
| P1-2 | Facet weighting makes era/reach/language 8× all themes combined | `signature-films.ts:256` |
| P1-3 | Rank promotion driven by reviews/rewatches/breadth (achievements, not depth) | `taste-card.ts:152-207` |
| P1-4 | Two season weights inside one gate (ladder ≈4×, milestone 1×) | `taste-card.ts:41` vs `:182` |
| P1-5 | `primaryTheme` = rarest, not most central | `signature-films.ts:114` |
| P1-6 | Modifier always fires — furthest z across unrelated axes; `RESTATES` patches the symptom | `taste-card.ts:648`, `:1036` |
| P1-7 | Captions overclaim (IMDb-only counts; "subtitled" from language) | `signature-films.ts:356`, `:359` |
| P1-8 | Traits mix identity with cumulative achievement; 27 defs, 12 `both` / 7 `film` / 8 `show` | `taste-card.ts:1249` |
| P1-9 | Variant axes are three more identity labels rather than silent art direction | `taste-card.ts:1158` |
| P1-10 | Anime reaches taste through exactly one counter | `taste-card-signals.ts:441` |

## P2 — cleanup

`themeKey` · `SLOT_LABELS` · `weightedSize` · `free(strict)` · `CLUSTER_KEYWORDS` ·
36 unreachable nouns · "eighteen traits" comment · PRODUCT.md "three of six" ·
inverted weighting comment · the four copies of the current-rating CTE.

---

# Recommended order

1. **P0-1, P0-8** — determinism first. Nothing else is measurable until identical
   input gives identical output.
2. **P0-3** — one canonical theme helper (`normalizeKeywords` → `themesFor`) used
   by Signature, Archetype, Theme DNA, Taste Match, Binder.
3. **P0-2** — replace "first 24" with a deterministic rule. Recommend
   *affection-weighted top-24 themes in this library*, documented as temporary.
4. **P0-4** — one canonical reach helper, shared bands, explicit `unknown`.
5. **P0-7, P0-10, P0-11** — pool correctness: classify `show`, admit posterless
   titles to computation with a render fallback, make rewatch/review per-title.
6. **P0-6** — rewrite `balance()` against the real objective, with tests.
7. **P0-5, P0-9, P0-12** — resolve the fake contract, the provisional low-data
   shape, and the privacy-scope split.
8. **P2** — delete dead code once the above stops depending on it.
9. **P1** — only then reopen the product model.

Do not start P1 before P0-1. Every P1 judgement needs a stable baseline to
compare against.
