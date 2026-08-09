# Rank redesign — Library Depth

The grind stays. Six tiers stay. What changes is what the number means, how it
is explained, and what it is allowed to touch.

---

## 0. Read this before trusting any threshold

**The crowd is synthetic.** 82 of the 83 accounts are generated fixtures
(`PRODUCT.md`, Evidence on Hand). Any threshold fitted to them describes the
seed generator, not human beings. The numbers in §4 are a **starting curve to be
re-fitted on the first real cohort**, not a finding.

Three things in this document *are* real evidence and survive the caveat,
because they come from TMDB metadata and from the schema rather than from
generated diaries:

1. Episode counts per season (real TMDB data) — §3.
2. Movie runtimes (real TMDB data) — §3.
3. Every structural finding in §1.

---

## 1. Audit of the current progression

Measured on the live database, 2026-08-08.

### Library sizes (rated rows per user)

| users | min | p25 | p50 | p75 | p90 | max | mean |
|---|---|---|---|---|---|---|---|
| 83 | 20 | 81 | 171 | 240 | 281 | 308 | 160 |

### What the current ladder actually awards

| tier by count | users | share | min films seen at this tier |
|---|---|---|---|
| Common | 7 | 8% | 16 |
| Uncommon | 12 | 14% | 29 |
| Rare | 34 | 41% | 60 |
| **Epic** | **30** | **36%** | **155** |
| Legendary | 0 | 0% | — |
| Mythic | 0 | 0% | — |

**The curve is the wrong shape.** The fourth of six tiers holds 36% of the
population, and the top two are unreachable by anyone. A collectible ladder
where a third of holders sit on rung four and nobody has ever seen rungs five or
six is not a progression, it is a plateau.

### F1 — The advertised rule is not the implemented rule

`RARITY_TIERS` prints `"300 films or 75 seasons"` (`taste-card.ts:89`).
`ladderProgress` computes **`films/floor + seasons/seasonFloor`**
(`taste-card.ts:266`) — a *sum of fractions*, not an "or".

The data proves the gap: the lowest film count holding Epic is **155**, not 300,
because 155 films + 45 seasons = `0.517 + 0.600 = 1.117` rungs.

A user reading their own card cannot derive their own rank. This is the single
biggest failure against "understandable", and it is a copy bug as much as a
maths one.

### F2 — Rank is never persisted for almost anyone

| stored tier | users |
|---|---|
| *(never synced)* | 82 |
| Uncommon | 1 |

`syncUserTier` (`taste.ts:811`) only runs on diary mutations. Seeded accounts
never triggered it. **Consequence for migration: there is almost nothing to
protect.** Right now is the cheapest moment this system will ever have to change
its formula (§5).

### F3 — The whole-show rank lever has never been exercised

`whole_shows = 0` for **all 83 users**. Yet `show_credit`
(`taste-card-signals.ts:243`) grants `total_seasons` credit for a single
whole-show rating. One rating on a long-running series is worth ~N seasons ≈ 4N
film-equivalents. It is the largest single-action lever in the product and it is
completely untested.

### F4 — Season runtime is unavailable

`films.runtime` is **NULL for all 292 season rows**. Any weighting that wants
minutes must either back-fill runtime or derive commitment from `episode_count`,
which is fully populated (0 unknown).

### F5 — Rank leaks into taste through a shared constant

`signature-films.ts:4` imports `SEASON_WEIGHT` from `taste-card.ts`. The ladder's
weighting constant therefore decides **how many Signature slots a series may
hold** (`balance()`, `:592`). Changing the rank weight silently changes the
identity output. This violates "rank never directly changes taste outputs"
today, before any redesign.

### F6 — Milestones are taste-flavoured

Three of the five promotion conditions — genres, decades, reviews
(`taste-card.ts:152-158`) — are breadth and behaviour, not depth. This is the
Rank/Identity conflation the brief sets out to end.

---

## 2. What rank must answer

> **How deep is this person's Tenpoint library?**

Depth is *volume of recorded opinion*, weighted by how much watching each unit
represents. It is not breadth, not obscurity, not effort, not sophistication.

---

## 3. Movie vs season weighting — evidence

The brief says do not blindly keep `SEASON_WEIGHT = 4`. So it was checked.

**Movies** (n=260, runtime 100% populated): mean **119.9 min**, median 110.

**Seasons** (n=292, episode_count 100% populated): mean 15.5 episodes, median 12.
Across seasons people actually rated (n=2,253 rows): **mean 13.9, median 12.**

Episodes per season by form:

| form | shows | seasons | avg episodes |
|---|---|---|---|
| live_action | 43 | 204 | 12.4 |
| animation | 5 | 58 | 19.7 |
| anime | 15 | 30 | 28.4 |

Season runtime is unavailable (F4), so minutes come from standard per-episode
durations for each form:

| form | eps | × min/ep | season minutes | ÷ 120 min movie |
|---|---|---|---|---|
| live_action | 12.4 | 45 | 558 | **4.7** |
| animation | 19.7 | 22 | 433 | **3.6** |
| anime | 28.4 | 24 | 682 | **5.7** |
| **weighted by rated volume** | | | **≈546** | **≈4.5** |

### Verdict: keep 4, and now it is defensible

`SEASON_WEIGHT = 4` sits just under the measured ≈4.5 and is therefore
**slightly conservative** — it under-credits television rather than over-credits
it, which is the safer error for a film-first product. It survives the audit on
evidence rather than on inertia.

**Do not per-form weight.** Anime would be worth 5.7 and animation 3.6, so an
anime watcher would climb 58% faster than an animation watcher for the same
number of seasons. That is a visible unfairness bought for a rounding error, and
it contradicts "anime is a kind of show, not a separate universe".

**One caveat to state in code:** 4 is a *stated* ratio, not a derived one. The
card should say "a season counts as four films" out loud, because a hidden
multiplier is exactly what the brief rules out.

---

## 4. The Library Depth score

One integer. One rule. Printable on the card.

```
Depth =  1 × rated movies
      +  4 × rated seasons
      +  4 × whole-series ratings   (one season's worth — see §7)
      +  2 × completed shows        (capped at +50)
      +  1 × rewatched titles       (max 1 per title, capped at +25)
```

**Naming, as shipped:** the measure is **library depth**; the unit is **points**.
Rungs read "500 points", the binder reads "Issued at 500 points: a film is 1, a
season is 4", and the card's total row is labelled *Library depth*.

**Every line prints its own arithmetic.** The panel shows `73 seasons × 4 = 292`,
not `Seasons, 4 each — 292`. The second form cannot be checked without dividing,
and reads as though 292 were the number of seasons. A capped line says `capped`
rather than printing `40 × 1 = 25` and looking broken.

**Base dominates by construction.** At the Epic threshold (500) the two bonuses
together cap at 75 — **15% maximum, and only for someone who has genuinely
finished 25 series and rewatched 25 distinct titles.** Typical contribution is
near zero: the whole database currently holds 223 rewatch entries across 13,260
entries (1.7%).

**Anti-farming rules, each tied to an observed hole:**

| Rule | Why |
|---|---|
| Rewatch bonus counts **distinct titles**, max 1 each | `max_same_title` is already 4 in the data; without this, one film rewatched ten times is ten points |
| Reviews are worth **zero** depth | Writing is not watching. Reviews move to milestones (§6) |
| Genres and decades are worth **zero** depth | The brief's "no random genre checklist"; also removes the taste leak (F6) |
| Whole-show credit is **capped at the seasons that have aired** | Already true via `show_credit`, but see §7 — it needs a review before it is exposed to real users |

### Thresholds (starting curve — re-fit on real users)

| Tier | Depth | A shelf that reaches it |
|---|---|---|
| Common | 0 | anything at all |
| Uncommon | 60 | 60 films, or 15 seasons |
| Rare | 200 | 200 films, or 120 films + 20 seasons |
| Epic | 500 | 500 films, or 300 films + 50 seasons |
| Legendary | 1,200 | 1,200 films — a serious lifetime shelf |
| Mythic | 2,500 | 2,500 films — a stated ambition, not an accident |

### Measured against the current population

Estimated, then run for real once the code existed. **The estimate was wrong and
the measured column is the truth:**

| Tier | before | *estimated* | **measured** |
|---|---|---|---|
| Common | 7 | 7 | **9** |
| Uncommon | 12 | ~20 | **29** |
| Rare | 34 | ~40 | **44** |
| **Epic** | **30** | *~16* | **1** |
| Legendary | 0 | 0 | **0** |
| Mythic | 0 | 0 | **0** |

The estimate was made by eyeballing depth from rated-row counts and it
over-counted the top badly. Epic holds **one** account, not sixteen.

**This is harsher than intended in the middle, and it is being left alone.**
Two reasons:

1. The curve is calibrated for the **real** audience, not this one. These
   fixtures top out at ~308 rated rows; the deep-catalogue viewer PRODUCT.md
   describes arrives with a ~900-row import, which lands at 900 depth — **Epic
   on arrival, with Legendary visible ahead.** That is the intended shape.
2. Re-tuning thresholds to flatter a synthetic population is exactly the mistake
   §0 warns about. The bulge at Rare (44 of 83, 53%) is the number to watch, and
   the honest moment to move it is the first real cohort.

The deepest account (`leilalund`, 235 films + 73 seasons = **527 depth**) lands
just inside Epic, which is the right feeling for the best shelf present.

The deepest account in the database (235 films + 73 seasons = **527 depth**)
lands just inside Epic. That is the right feeling: the best shelf here today is
*impressive but not finished*.

A realistic arrival — the ~900-row Letterboxd import that PRODUCT.md names as the
main first session — lands at ~900 depth: **Epic on import, with Legendary
visible ahead of them.** Imports should feel recognised, not instantly maxed.

### Why one number beats two

The current rung states two counts and secretly adds fractions (F1). One integer
with fixed per-unit values can be explained in a sentence, checked by hand
against a diary, and printed as `527 / 1,200` without lying.

---

## 5. Migration — decided: clean recompute, no grandfathering

**Status: implemented.** The brief originally proposed
`new = max(previous earned, newly calculated)`, a monotonic floor. That was
built, shipped, seen in the running product, and then **overruled by the
product owner**: an account whose library no longer earns a rank is deranked.

This section records the options, what was actually built, and why it was
reversed — the reasoning is worth keeping even though the recommendation lost.

### The options as they were weighed

| Strategy | Protects | Cost |
|---|---|---|
| A. Monotonic floor `max(prev, new)` | everyone | Two identical libraries can hold different ranks **forever**. Inflation never drains |
| **B. Clean recompute** ← **chosen** | nobody | Honest and self-consistent. Demotes real users |
| C. Floor, recorded and self-healing | everyone who had a rank | A's protection, stored explicitly, inert once the computed rank overtakes it |
| D. Timed convergence | everyone, temporarily | Needs a scheduler and an explanation; more machinery than the problem deserves |

### Why C was recommended, and why that was wrong

C was recommended on the grounds that F2 made it nearly free: 82 of 83 accounts
had no stored rank, so the grandfathering liability was one account.

That reasoning was sound about the *cost* and silent about the *meaning*. The
tell was visible the moment it rendered. The card had to say:

> *"You reached Uncommon before the points scale changed, and it is yours to
> keep. 31 more earns it outright."*

Two ranks are being described at once — the one displayed and the one earned —
and the card has to apologise for the gap. A collectible whose label needs a
footnote about why it does not match the shelf is not doing the job. **The rank
should mean one thing.** That is what C could not deliver at any population size,
and it is why the cheapness argument was beside the point.

### What is implemented

- The tier is `tierFor(depth)`. Nothing is held back and nothing carried forward.
- `tierStanding(signals)` takes no floor. `floored`, `toEarn` and `earned` are
  gone from the type.
- The card panel shows only the climb: `COMMON → UNCOMMON`, `29 / 60`, the
  line-by-line sum, and the distance to the next rung.
- `nadia`, the only account with a stored tier, was resynced Uncommon → Common.

### The consequence to hold onto: rank can now fall

Under the old ladder rank could only rise, because it was a floor on a count
that only rose. Depth is recomputed from the current library, so **deleting
entries, marking them private, or a future change to the thresholds all move a
tier down.** That is the deliberate trade for a rank that always describes the
shelf in front of you.

### `tier_floor` survives as history, not as a shield

The column stays and `syncUserTier` still writes the high-water mark. It is read
by **one** consumer: the binder.

Without it, deriving "held" from the current tier alone would mean a deranked
account watched finishes it genuinely passed through turn back to *unheld* — a
binder quietly un-collecting things. So a tier reads held when it is below the
current tier **or** below the high-water mark.

Rank deranks. The collection does not get rewritten. If that distinction is ever
unwanted, deleting `everReached` from `binder.ts` collapses the binder onto the
current tier and the column becomes unused.

---

## 6. Milestones become collectibles

Milestones stop touching rank. `MILESTONE_TARGETS` (`taste-card.ts:152`) is
deleted from the promotion path; `tierStanding` loses its `promoted` branch and
the ladder becomes a pure function of Depth.

They come back as **collectibles that award finishes and binder plates** — the
binder already exists to hold exactly this, and `held_variants` already records
finish history.

| Collectible | Condition | Reward |
|---|---|---|
| International Explorer | 25 titles in 5+ non-English languages | a stock |
| Rewatch Archive | 25 distinct titles rewatched | a stock |
| Longform | 10 series completed | a stock |
| Classicist Collection | 30 titles released before 1970 | an accent |
| Director Deep Dive | 8 titles from one director | an accent |
| The Annotated Shelf | 50 reviews written | an accent |

Rules that keep them clean:

- **A collectible never changes Depth or tier.** It changes what the card is
  made of, never how far up the ladder it sits.
- **They are achievements, and they say so.** They are not traits and must not
  render in the traits panel — that is the identity/achievement split the whole
  redesign exists to draw.
- Each names a real condition against a real denominator, in the product's own
  voice, with no percentile claims (PRODUCT.md's standing rule).

This also resolves F6: breadth and reviews still have somewhere to go, and that
somewhere is not the ladder.

---

## 7. Whole-show credit needs a decision before real users arrive

`show_credit` grants every aired season for one whole-show rating (F3). At
`SEASON_WEIGHT = 4`, one rating on a 15-season series = **60 depth**, the same as
60 films, from a single action. Nobody has done it yet, so there is no data and
no incumbent expectation.

Three options, in order of preference:

1. **Credit whole-show ratings at a flat 4** (one season's worth). A statement
   about a series is one opinion, and Depth counts recorded opinions.
2. **Credit `min(total_seasons, 4) × 4`.** Compromise: a whole-show rating on a
   long series is worth more than one season but cannot exceed four.
3. **Keep full credit** and accept it as the intended reward for finishing a
   long series.

Recommend **1**, because Depth is defined as volume of recorded opinion (§2) and
one whole-show rating is one opinion. Season-level ratings remain the way to
convert a long series into real depth — which also protects the product's
strongest differentiator by making the granular path the rewarding one.

---

## 8. Visual progression

Constrained by `DESIGN.md`: no `box-shadow` on surfaces (**Tonal-Only Rule**),
depth from the graphite ladder, gold reserved for earned objects — which tiers
are, so gold is legitimate here and nowhere else.

Every tier must look deliberate. Common is not "the card without the good bits";
it is the same object in a plainer finish.

| Tier | Material | Motion | Existing hooks |
|---|---|---|---|
| **Common** | Matte graphite, `seam` hairline rim, crisp type. Complete and quiet | none | `sheenOp: 0` |
| **Uncommon** | Refined rim one tonal step up (`edge`), faint directional sheen across the ground | none | `sheenOp: 0.12` |
| **Rare** | `beam` rim gradient; a **serial number** in tabular figures — the first collectible mark | none | `sheenOp: 0.2` |
| **Epic** | Metallic rim; the foil sweep begins, slow and single-pass | 52s sweep | `sweepSec: 52` |
| **Legendary** | Gold refraction; the grain deepens; **parallax on pointer** so the card reads as a physical sheet | 42s sweep + tilt | `sweepSec: 42` |
| **Mythic** | Full iridescent interference (the existing difference-blend foil at full strength), drifting motes, and a **unique share reveal** — the share image animates its sweep once | 34s sweep + motes | `sheenOp: 0.7`, `sweepSec: 34` |

The existing `RARITY_TIERS` rows already carry `sheenOp`, `sweepSec`, `border`,
`glow` and `swatch` for all six, so this is a re-specification of values that
exist rather than new machinery. Two additions only: the **serial number** at
Rare and **parallax** at Legendary.

**Reduced motion:** every sweep, mote and tilt above must be listed in the
`prefers-reduced-motion` block in `globals.css`, which currently disables every
named animation. A new tier animation that is not listed is a defect
(DESIGN.md's own Do).

---

## 9. Acceptance criteria — how each is met

| Criterion | How |
|---|---|
| Still grindable | Depth rises with every rating, forever; Mythic at 2,500 is a genuine long game |
| User understands why rank rose | One integer, fixed per-unit values, `527 / 1,200` printed. Fixes F1 |
| Rank never changes taste outputs | Milestones leave the ladder (§6); **and `SEASON_WEIGHT` must be forked** so Signature balance stops importing the rank constant (F5) |
| ~~No unfair demotion~~ **Rank always describes the current library** | **Criterion changed by the owner after seeing it run.** Grandfathering was built and reversed: a rank that needs a footnote explaining why it outruns the shelf means two things at once. Demotion is now correct behaviour, and rank can fall (§5) |
| Milestones stay fun, separated from identity | Collectibles award finishes and plates, never rank, never traits (§6) |
| Clear visual reward | Six distinct finishes, all of them good (§8) |

---

## 10. Implementation order

1. **Fork `SEASON_WEIGHT`** — give `signature-films.ts` its own constant. Fixes
   the existing rank→taste leak (F5) before anything moves.
2. **Add `libraryDepth(signals)`** as one pure function returning
   `{ depth, breakdown, tier, next, toNext }`.
3. **Add `users.tier_floor`** as the high-water mark. *Not* a rank shield — it is
   read only by the binder, so a deranked account keeps the finishes it passed
   through (§5).
4. **Switch `tierStanding` to Depth**, delete the `promoted` branch.
5. **Fix the tier copy** so the rung states the Depth number, not "films or
   seasons" (F1).
6. **Decide whole-show credit** (§7) before any real user rates a show whole.
7. **Move milestones to collectibles**, wired to `held_variants`.
8. **Re-specify the six finishes**, adding reduced-motion entries.
9. **Re-fit thresholds** on the first real cohort. §4 is a starting curve.

Steps 1–5 are self-contained and can land before any visual work.
