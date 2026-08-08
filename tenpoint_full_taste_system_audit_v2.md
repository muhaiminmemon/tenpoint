# Tenpoint Taste System — Full Audit
## Current-state critique, including the complete Signature Films selection pipeline

This audit is based on the current implementation described in the supplied Tenpoint taste-system reference.

The goal here is **not** to propose the final replacement architecture in detail. The purpose is to identify what is wrong with the current system, why those problems matter, which issues are implementation bugs versus product-model flaws, and which ideas are worth preserving.

---

# Executive Verdict

The current system is **clever but over-engineered around the wrong abstractions**.

It contains many good local solutions:

- relative rating conviction;
- evidence gates;
- shrinkage for rare themes;
- shared value + explanation functions;
- affection weighting;
- soft redundancy penalties;
- season-level signals;
- privacy-aware computation.

But the system has accumulated too many independent layers, patches, thresholds, fallback tables, corrective penalties, frozen priors, and special cases.

The result is a taste card that is mathematically busy without having a single clean definition of what “taste” means.

The biggest systemic problems are:

1. **Progression mostly measures consumption, not how well Tenpoint understands someone.**
2. **Archetype mostly describes what appears in a library, not what the user disproportionately loves.**
3. **Traits claim to describe taste but are mostly cumulative achievements.**
4. **Visual variants repeatedly encode the same signals using arbitrary mappings.**
5. **TV/anime are still partially bolted onto a film-first ontology.**
6. **The Signature Films algorithm currently contradicts its own stated objective.**
7. **Several identity outputs can disagree because they use subtly different theme definitions, metadata sources, and weighting rules.**
8. **The system is patch-driven: many components now exist mainly to repair side effects created by other components.**
9. **Low-data accounts are given far more certainty than the evidence supports.**
10. **The product doctrine says the card is not an engagement loop, while tiers, milestones, trait rungs, near-misses, and finishes behave exactly like one.**

The system does not need more patches.

It needs a smaller number of well-defined concepts.

---

# 1. The Card Has Too Many Independent Identity Systems

The current card includes:

```text
Level
Rarity Tier
Milestones
Archetype Modifier
Archetype Noun
Variant Stock
Variant Accent
Variant Aura
27 Traits
Personality Axes
Theme DNA
Signature Films
Taste Match
```

The immediate product question becomes:

> Which of these is actually the user's identity?

If someone is:

```text
Level 214
Epic
Coldwater Nightcrawler
Neon Rain
Emerald
Cosmic
Precisionist III
World Tour II
```

the system has produced many labels but not necessarily a clearer understanding of the person.

A strong identity system should have a hierarchy.

Currently, several layers independently attempt to answer:

> “What kind of viewer are you?”

That creates repetition, contradiction, and cognitive overload.

---

# 2. The Product Says “Not a Game,” but the Mechanics Are a Game

The product doctrine says the Taste Card is:

> an identity artifact derived from taste, not an engagement loop.

But the implementation contains:

- rarity tiers;
- progression bars;
- milestone gates;
- “three of five” promotion logic;
- three-rung collectible traits;
- new-trait unlock dots;
- visual rarity finishes;
- near-miss messages;
- a binder showing finishes held and unheld.

That is an engagement/progression loop in everything but name.

This is not inherently bad.

The problem is **conceptual dishonesty**.

Tenpoint needs to choose:

### Option A
The card is purely an identity portrait.

or:

### Option B
The card is an identity portrait with collectible progression.

Either can work.

The current system tries to have the psychological benefits of B while declaring itself A.

---

# 3. Rarity Tier Is Fundamentally a Consumption Ladder

Current progression ultimately depends heavily on:

```text
40 / 120 / 300 / 700 / 1400 films
10 / 30 / 75 / 175 / 350 seasons
```

A user becomes “Mythic” primarily by consuming an enormous volume of media.

That does not mean their taste profile is:

- more distinctive;
- better understood;
- more stable;
- more interesting;
- more internally coherent.

It means they logged more.

This is a major mismatch if rarity is intended to express the maturity or uniqueness of the Taste Card.

---

# 4. Milestones Do Not Really Fix the Grind Problem

The milestone system looks more nuanced because it includes:

```text
Titles
Genres
Decades
Reviews
Rewatches
```

But most of these still reward accumulation.

A user can intentionally optimize for them:

- watch one title from another genre;
- watch one title from another decade;
- write enough reviews;
- rewatch enough titles.

That creates a checklist.

The one-rung cap prevents runaway promotion, but it does not change the underlying meaning:

> progression is still about doing more things.

If the card is supposed to become rarer because Tenpoint understands the user's taste better, the progression objective should be **evidence quality and confidence**, not task completion.

---

# 5. Level Is Redundant With Tier

Level is described as simply:

> how much is rated.

Tier is also heavily based on:

> how much is rated.

So two card layers communicate largely the same underlying information.

A useful test for every card component is:

> Does this visible element tell me something meaningful that no other visible element already tells me?

Level fails that test.

---

# 6. The 4:1 Film-to-Season Exchange Rate Is Arbitrary

The system defines:

```text
SEASON_WEIGHT = 4
```

and uses roughly a 4:1 relationship between film and season thresholds.

The reasoning is understandable:

- counting rows underweights TV;
- counting hours overweights TV;
- four sits between them.

But “four” is still an arbitrary compromise.

A season can be:

```text
6 × 20 minutes
8 × 60 minutes
12 anime episodes
25 anime episodes
40 broadcast episodes
```

Treating all seasons as four films means the taste system inherits arbitrary production and metadata boundaries.

This gets especially unstable with anime cours and unusually long seasons.

---

# 7. Whole-Series Ratings Are Incorrectly Treated as Season Evidence

The current system says rating an entire series credits all its seasons for progression.

That conflates two very different facts:

```text
“I rate Breaking Bad 9.7 overall.”
```

and:

```text
“I individually evaluated all five seasons.”
```

The first gives strong evidence that the user loves the show.

It gives **zero direct evidence** about:

- which season they preferred;
- whether the show grew on them;
- whether the finale disappointed them;
- how consistent they thought it was.

The system should distinguish:

```text
series opinion
season evidence
```

Currently it partially collapses them.

---

# 8. The System Uses Inconsistent Units Depending on the Feature

Depending on the calculation, TV can become:

- one whole series;
- several seasons;
- seasons × 4;
- a single collapsed `cur_work`;
- a series count shown to the user.

This means “how much TV is in this person's taste?” has no single canonical unit.

Different representations can be justified for different questions, but the system currently has too many implicit unit changes.

That makes the model difficult to reason about and easier to break.

---

# 9. The Full Card Appears Far Too Early

Current thresholds:

```text
5 ratings → archetype eligible
8 ratings → full card
```

Eight titles are not enough for a confident identity portrait.

At eight ratings:

- one franchise can dominate;
- one director can dominate;
- one country can dominate;
- one anime can contribute multiple seasons;
- a user's rating mean and spread are unstable;
- theme prevalence is highly sensitive;
- signature selection is mostly noise.

The product can absolutely show something at eight ratings.

It should not imply the same confidence as a profile based on hundreds.

---

# 10. There Is No Proper Identity Confidence Model

The current system has evidence gates scattered across components.

That is good locally.

But there is no single concept answering:

> “How confident are we that this portrait is accurate?”

Instead:

- archetype has one gate;
- modifiers have different gates;
- personality axes have other gates;
- signature films have another threshold;
- tiers use consumption;
- traits have rung thresholds.

A coherent Taste Card needs a first-class **confidence model**.

---

# 11. The Archetype Noun Mostly Describes Exposure, Not Preference

The noun system looks for themes that appear unusually often relative to catalogue prevalence.

That answers:

> “What subjects are unusually common in this library?”

It does **not necessarily answer**:

> “What kinds of stories does this person love most?”

Example:

```text
40 superhero titles averaging 6.5
12 psychological thrillers averaging 9.4
```

The occurrence-based system can still heavily favor the superhero theme.

But most users would say the psychological thrillers reveal more about their taste.

The system needs a stronger distinction between:

```text
what you watch
```

and:

```text
what you disproportionately love
```

---

# 12. One Keyword Can Put a Work Into a Theme

A title joins a theme cluster if it carries any one matching keyword.

This is too brittle for a flagship identity system.

The implementation has already discovered this problem:

- “based on manga” falsely captured unrelated anime as shounen;
- “investigation” grouped unrelated works;
- noisy TMDB mood and production tags require a stoplist.

These are not isolated bugs.

They are evidence that binary membership based on any one keyword is an unstable semantic representation.

---

# 13. Theme Detection Is Inconsistent Across the Product

This is a direct correctness bug.

The main taste-signals pipeline applies `KEYWORD_STOPLIST`.

The Signature Films candidate builder does not.

That means the same title can be considered to have a theme in Signature Films and not have that theme elsewhere.

Example from the current implementation:

```text
"cartoon"
```

can influence the adult-animation cluster in Signature Films while being removed in taste-card signals.

This violates one of the system's strongest stated principles:

> one source of truth should drive both a value and its explanation.

---

# 14. The Theme Ontology Was Originally Film-First

The system explicitly added new theme nouns because major TV/anime titles such as:

- The Office;
- The Simpsons;
- Attack on Titan;

were not represented by the original film-derived clusters.

That means TV/anime were not first-class concepts in the ontology.

They were patched in after the fact.

Now that Shows are a core Tenpoint medium, the semantic model should be designed around:

> stories and viewing experiences across screen media

rather than:

> film keywords plus TV exceptions.

---

# 15. Some Theme Names Are Too Opaque for a Shareable Card

Examples include:

```text
Fence
Badge
Cleaner
Specimen
Lifer
Handler
Signalman
```

They may be clever after reading the binder.

But a social identity label should ideally be mostly understandable before explanation.

A shared card reading:

```text
Coldwater Badge
```

does not immediately communicate taste.

The names should be:

- distinctive;
- elegant;
- interpretable;
- screenshot-safe.

---

# 16. “Degenerate” Is a Risky Identity Label

The adult-animation archetype noun is:

```text
Degenerate
```

It may be funny in an internal demo or among some users.

But the Taste Card is intended to be:

- public;
- shareable;
- identity-defining.

A user should not unexpectedly receive an insulting or embarrassing label because they watched adult animation.

Tone matters.

---

# 17. Frozen Cluster Prevalence Solves Stability but Creates Model Staleness

The system intentionally freezes catalogue prevalence so identities do not shift when the catalogue grows.

That is a good goal.

But permanently frozen prevalence eventually becomes inaccurate as:

- catalogue composition changes;
- TV/anime volume grows;
- metadata quality changes;
- user behavior changes.

The correct solution is **model versioning**, not eternal priors.

A user's card should not drift daily.

But Tenpoint should be able to intentionally move from:

```text
Taste Model v1
```

to:

```text
Taste Model v2
```

when the underlying assumptions need recalibration.

---

# 18. Modifier Axes Mix Incomparable Concepts

The modifier competition includes:

- average rating;
- rating spread;
- era share;
- TV share;
- number of languages;
- rewatch share;
- director concentration;
- actor concentration;
- IMDb disagreement;
- decimal usage;
- popularity preference.

These are fundamentally different kinds of facts:

```text
taste preference
library composition
rating behavior
UI behavior
media format
external-score relationship
```

Yet all compete in one z-score tournament for the single modifier slot.

That makes the resulting word unstable conceptually.

A user may be named after decimal usage rather than what they actually enjoy.

---

# 19. The “Furthest Z-Score Always Wins” Rule Manufactures Significance

The modifier system intentionally guarantees an answer:

> whichever axis is furthest from ordinary wins.

But there is a major difference between:

```text
the most unusual thing about you
```

and:

```text
something genuinely unusual about you.
```

Someone can be near-normal on every dimension.

The system still chooses the least-normal normal attribute and elevates it into their identity.

That is false precision.

There should be a notability threshold.

---

# 20. Modifier Priors Have Mixed Provenance

Some anchors were:

- initially guessed;
- later measured from seeded users;
- measured from real users;
- deliberately left as priors because the seed generator invents behaviors.

That means axes competing in one standardized system do not all have equally reliable “typical” and “spread” estimates.

A z-score only becomes meaningfully comparable if the reference distributions are credible.

---

# 21. Some Modifiers Are Not Taste

Examples:

```text
Hairline / Hardstop
```

comes from decimal rating usage.

That primarily describes how the user interacts with Tenpoint's rating UI.

Likewise, raw language count, TV share, and some creator-frequency metrics may describe consumption patterns more than preference.

They may be fun profile stats.

They should not necessarily compete to define the user's central archetype.

---

# 22. TV Share as an Archetype Modifier Is Weak Semantics

A person can become:

```text
Boxset ...
```

simply because much of what they rate is television.

That tells us format preference, not story taste.

Now that shows are first-class, “you watch TV” should not itself be treated as an unusually rich identity descriptor.

---

# 23. `RESTATES` Is Evidence the Naming Architecture Is Fighting Itself

The system needs a blacklist to prevent combinations such as:

```text
Secondrun Repeat Offender
Fullhouse Roommate
```

because independently chosen modifier and noun slots restate the same concept.

The blacklist fixes examples.

It does not fix the structural issue:

> two independently optimized labels are being concatenated without understanding their combined meaning.

As more labels are added, this blacklist will keep growing.

---

# 24. The Genre Fallback Is Vastly Overbuilt

When no theme qualifies, the system has:

```text
18 lead genres × 6 families = 108 nouns
```

This is an enormous secondary naming system for the accounts with the **least evidence**.

That is backwards.

Thin libraries should receive simpler, more cautious identity output.

They do not need the largest fallback vocabulary in the system.

---

# 25. 36 Fallback Nouns Are Unreachable

The `vintage` and `foreign` columns exist in the fallback table but the selection code never produces those families.

So:

```text
36 of 108 fallback nouns
```

cannot currently be selected.

This is a direct implementation defect and a sign that the archetype layer has become hard to maintain.

---

# 26. The System Prefers Fabricated Certainty Over “Still Developing”

The fallback architecture exists largely because the system wants everyone to have a title.

But an identity system should be allowed to say:

```text
Still forming.
```

That is better than a confident but low-evidence label.

---

# 27. Variant Stock Duplicates the Archetype Theme

Stock is derived from the signature theme.

The archetype noun is also derived from the signature theme.

So the system often says the same thing twice:

```text
Nightcrawler
+
Neon Rain
```

One appears as language.

One appears as visual design.

That uses two major identity surfaces for one underlying signal.

---

# 28. Accent Color Is Based on an Arbitrary Decade Mapping

Current logic maps highest-rated decade to:

```text
Crimson
Cobalt
Emerald
Amethyst
```

There is no natural semantic reason:

```text
2010s → Emerald
```

or:

```text
1970s → Cobalt.
```

This is personalized in the technical sense but not in a meaningful sense.

The best personalized visuals should feel explainable.

---

# 29. Aura Is Based on an Arbitrary Average-Rating Mapping

Current aura maps mean rating to:

```text
Noir
Dream
Cosmic
Analog
```

Again, the semantic connection is unclear.

Why does a generous rater become Analog?

Why does a 7.8 average become Cosmic?

This is an example of data being converted into personalization even when the mapping itself carries no intuitive meaning.

---

# 30. Visual Quality Is Tied to Consumption Volume

Higher tiers receive:

- better edges;
- foil;
- glow;
- particles;
- richer animation.

Because tiers are mostly count-driven, the card effectively says:

> consume more media → receive a prettier identity.

That turns the Taste Card into an achievement ladder even though the product doctrine says it is not one.

---

# 31. Visual Categories Can Change for Reasons Unrelated to Meaningful Taste Change

Accent uses decade buckets.

Aura uses average-rating buckets.

A small change near a threshold can produce a discrete visual switch even when the user’s actual taste has barely changed.

There is no explicit hysteresis for these variant components.

---

# 32. Traits Say They Are Not About Quantity, but Most Are Quantity

The system explicitly says:

> traits are about what you watch, not how much.

Yet examples include:

```text
Early Cinema        1 / 5 / 15
One Director        6 / 9 / 14
Marathon Runner    18 / 26 / 40
Perfect Ten         6 / 15 / 30
Reads the Subtitles 15 / 28 / 50
Season Ticket       40 / 60 / 100
Channel Surfer      15 / 22 / 35
```

These are cumulative counters.

They are achievements.

That contradiction should be resolved explicitly.

---

# 33. Trait Rungs Turn Identity Into a Grind

A trait having:

```text
I
II
III
```

means the strongest version usually goes to the person with the largest library.

Example:

A user with:

```text
30 non-English works out of 40
```

may have a much stronger international preference than:

```text
50 non-English works out of 1,200
```

but the second user gets the higher raw-count rung.

Identity traits should generally use:

- proportions;
- lift;
- effect size;
- confidence;
- stability.

Not raw totals.

---

# 34. Trait Ranking Rewards Accumulation

Traits are ranked by:

1. rung level;
2. distance beyond the last rung.

That guarantees quantity dominates which traits are most prominent.

The top trait is not necessarily:

> the most revealing thing about this person's taste.

It is often:

> the counter they have advanced furthest.

---

# 35. Precisionist Is Primarily a UI-Usage Trait

`Precisionist` measures how often the user enters decimal ratings.

That is not really a taste preference.

It may be fun metadata.

It should not occupy the same conceptual layer as:

- international preference;
- finale behavior;
- director loyalty;
- obscure-title preference.

---

# 36. Perfect Ten and Tough Critic Are Library-Size Dependent

Raw counts of:

```text
10.0 ratings
≤3.0 ratings
```

grow automatically with library size.

A proportion or behavior model would better capture whether someone is unusually generous, harsh, polarized, or selective.

---

# 37. World Tour Measures Exposure, Not Preference

Distinct language count says:

> how many languages appear.

It does not say:

> whether the user disproportionately loves international work.

A user who watched one mediocre title in twelve languages can outrank someone whose favourite films are overwhelmingly non-English.

---

# 38. Deep Cut Is Also a Count Achievement

“Titles in one genre” with thresholds like:

```text
80 / 115 / 170
```

mostly rewards library size.

A better “deep specialization” measure would be:

```text
genre share relative to catalogue expectation
× affection
× confidence.
```

---

# 39. Critic-Based Traits Give External Scores Too Much Identity Power

The card has several ideas centered on IMDb or Rotten Tomatoes:

- Critics Agree;
- Against the Grain;
- Second Opinion;
- criticGap modifier;
- crowdBias modifier.

That gives external-score disagreement a surprisingly large role in personal identity.

Tenpoint's strongest differentiation should be:

> your taste, your friends, and your social graph.

External critic relationships can be fun secondary observations.

They should not dominate the identity model.

---

# 40. Critic Metrics Are Also Format-Asymmetric

Some critic traits are film-only because Rotten Tomatoes coverage is used.

This makes the trait system structurally favor films even though shows and anime are now first-class.

---

# 41. The TV Trait Set Mixes Excellent Insights With Basic Counters

Good concepts:

```text
Fell Off
Grew Into It
```

Weak identity concepts:

```text
Season Ticket
Channel Surfer
Long Haul
Closed Book
```

The latter mostly describe quantity or completion.

The former derive genuine behavior from season-level ratings.

Tenpoint should lean much harder toward the second type.

---

# 42. `Subbed and Dubbed` Does Not Measure What Its Name Implies

The trait simply counts anime seasons.

It does not measure:

- subbed viewing;
- dubbed viewing;
- anime style;
- anime themes;
- anime preference.

So both the name and the underlying identity claim are weak.

Anime should contribute naturally to the same semantic taste model as other shows.

---

# 43. `Fell Off` / `Grew Into It` Are Good but Too Crude

They compare:

```text
first rated season
vs
last rated season
```

and require a 3.0-point difference.

This ignores the actual shape of the series.

Example:

```text
8.0 → 9.8 → 9.7 → 8.1
```

would look nearly flat first-to-last even though the show had a huge middle peak.

A better model could detect:

- upward trajectory;
- downward trajectory;
- late collapse;
- recovery;
- consistency;
- volatility.

These are excellent opportunities created by season ratings.

---

# 44. `cur_work` Fixes Duplication by Throwing Away Potentially Useful Season Detail

Collapsing a series to one row prevents:

> 38 Simpsons seasons = 38 Matt Groening credits.

That is correct for creator concentration.

But it also means the system needs to be careful not to discard legitimate season-specific changes:

- showrunner changes;
- cast changes;
- director changes;
- decade shifts;
- tone changes.

The normalized media model needs separate:

```text
work-level evidence
season-level evidence.
```

---

# 45. The Displayed TV Count and the Internal TV Share Use Different Concepts

The card prints:

```text
series count
```

while internal share is:

```text
season-weighted
```

So the visible number and the derived profile are based on different units.

That can make explanations confusing.

---

# 46. Personality Axes Are Mostly Library Statistics, Not Personality

The back-of-card axes are:

```text
rating distribution
era
runtime
reach
rewatch
```

These are useful descriptive statistics.

Calling them “personality” gives them more interpretive meaning than they actually have.

They describe:

> the composition of the library.

They do not necessarily describe:

> what the user values.

---

# 47. The Personality Layer Is Still Film-First

Runtime uses film duration.

Era is described in film terms.

Reach relies on title audience-count metadata.

Now that shows and anime are core, the back needs genuinely cross-media dimensions or separate film/show subviews.

---

# 48. Absolute Rating Bands Conflict With Relative Conviction Elsewhere

Personality uses absolute bands such as:

```text
Loved = 8.5+
```

Signature conviction correctly recognizes that a harsh rater's 8.5 may mean the same thing as a generous rater's 9.5.

The system therefore has two incompatible definitions of “loved”:

- absolute on the back;
- user-relative in Signature Films.

This should be unified or deliberately distinguished.

---

# 49. Theme DNA Repeats the Archetype's Underlying Signal

Theme DNA surfaces the same theme-lift system used to create the archetype noun.

That can be useful as an explanation.

But it means the back should be clearly framed as:

> evidence for the archetype

rather than another independent identity output.

---

# 50. Signature Films — How the Current Algorithm Actually Works

This is the most important newly documented section.

The current stated goal is:

> choose four films that form a portrait of the user's library, not simply their top four.

The actual pipeline is:

---

## Step 1 — Build the candidate pool

The query retrieves every currently rated film/season with a poster.

A title with no `poster_path` is excluded entirely.

Candidate fields include:

```text
rating
kind
director
year
language
IMDb rating
TMDB vote count
IMDb votes
viewings
reviews
themes
primary theme
embedding
```

The query's outer select has **no ORDER BY**.

That matters later.

---

## Step 2 — Compute conviction

The user's rating is normalized against their own mean and standard deviation:

```text
z = (rating - user mean) / user SD
```

This is a good idea.

It means an 8.5 from a harsh marker can carry similar conviction to a 9.5 from a generous marker.

If the user has fewer than 10 candidates, the entire portrait algorithm is skipped.

The system simply:

```text
sorts by rating
breaks ties alphabetically
takes four
```

and gives all four effectively the same explanation.

---

## Step 3 — Build a 32-dimensional portrait vector

The vector contains:

```text
24 theme dimensions
4 era dimensions
3 reach/popularity dimensions
1 non-English dimension
```

The 24 themes are selected by:

```text
first 24 distinct themes encountered while iterating candidates.
```

They are **not**:

- the top 24;
- the most common;
- the most distinctive;
- the most affection-weighted.

Because the database query is not ordered, this set is partly arbitrary.

---

## Step 4 — Weight the vector

Each theme gets:

```text
1 / number_of_theme_dimensions
```

while every era, reach, and language dimension gets:

```text
1
```

Therefore all themes together contribute roughly one unit of weight, while the eight non-theme dimensions contribute eight units.

In practice the portrait is dominated by:

```text
era
popularity
language
```

not story/content taste.

---

## Step 5 — Compute affection

Base component:

```text
rating conviction
```

Optional components:

```text
rewatch
review
```

But the optional dimensions activate globally.

If **any** title in the user's library has a rewatch, every title is suddenly scored on the rewatch dimension.

If **any** title has a review, every title is scored on review presence.

The weighted average is renormalized over those active dimensions.

---

## Step 6 — Compute the target portrait

For every candidate:

```text
weight = 0.15 + affection
```

Then Tenpoint calculates the affection-weighted average facet vector across **all candidates**.

That target is intended to represent:

> the shape of the library the user actually cares about.

---

## Step 7 — Pick Slot 1: the Anchor

The anchor is:

```text
highest conviction
tie → highest TMDB vote count
```

In plain language:

> the user's highest-rated title, with ties intentionally favoring the more famous title.

This is one quarter of the card.

---

## Step 8 — Create the eligibility pool for Slots 2–4

Candidates generally need to fall in the user's top rating decile.

For thin cases the threshold can relax toward:

```text
mean + 0.75 SD.
```

So the portrait target is calculated over the whole candidate library, but the selectable titles mostly come only from the user's favourites.

---

## Step 9 — Greedy selection for Slots 2–4

Three times, evaluate every eligible unused candidate:

```text
value =
    affection
  + 0.6 × positive coverage gain
  - 0.25 if director repeated
  - 0.15 if primary theme repeated
  - embedding duplicate penalty
```

Coverage gain measures how much adding the candidate moves the current set's average facet vector toward the whole-library target.

The highest-value candidate is chosen.

Then repeat.

---

## Step 10 — Add near-duplicate protection

If the embedding cosine similarity to a chosen title is at least 0.75, apply:

```text
-0.7 × similarity
```

The embedding is intentionally used only as a franchise/near-duplicate guard.

If the title has not yet been embedded by the overnight job, it receives no embedding penalty.

---

## Step 11 — Generate a caption

The system identifies the single facet the selected title most helped with.

Possible roles include:

```text
the one about heists
the one from the 1970s
the recent one
the one everybody knows
the one almost nobody knows
the subtitled one
```

Rewatch captions override this:

```text
The one you go back to.
```

Review presence can also become the fallback explanation.

---

## Step 12 — Force film/series balance afterward

After the four titles have been optimized, the system calculates the desired TV count from:

```text
(seasons × 4) / (seasons × 4 + movies)
```

with a minimum of one TV slot after at least three rated seasons and generally a maximum of three if the user also has at least three films.

If the selected quartet does not have the desired balance, it swaps titles.

The replacement is chosen from the other medium largely by raw rating.

The caption is replaced with a generic media-balance explanation.

---

# 51. Signature Problem: The Anchor Defeats the Entire Concept

The feature exists specifically because:

> a signature should not just be a top-rated canonical title.

Yet Slot 1 is:

```text
highest conviction
tie → most popular.
```

For someone with many 10s, the anchor becomes:

> the most famous 10.

That systematically pushes canonical movies onto the card.

Alphabetical tie-breaking was random.

Popularity tie-breaking is systematically generic.

---

# 52. Signature Problem: The Target and Candidate Pool Describe Different Populations

This is one of the deepest mathematical flaws.

The target represents:

```text
the affection-weighted whole library.
```

The eligible selection pool is:

```text
roughly the top decile.
```

Those populations are not the same.

A user's favorites may be systematically:

- older;
- newer;
- more obscure;
- more international;
- more genre-specific;

than the whole library.

The algorithm asks the top decile to reproduce a target that was created from the entire library.

Sometimes that target is literally unreachable by the eligible pool.

This encourages bizarre compensating selections.

The current document accurately summarizes the effect as something close to:

> “your favourites, made weird.”

---

# 53. Signature Problem: Subject Matter Barely Matters

All theme dimensions together carry roughly:

```text
11%
```

of nominal vector weight.

Era, reach, and language dominate.

So the algorithm mostly asks:

> Can these four favourite titles reproduce your typical age/popularity/language profile?

rather than:

> Can these four titles explain what kinds of stories you love?

This is backwards for a feature called Signature Films.

---

# 54. Signature Problem: The Theme Space Is Nondeterministic

The 24 theme dimensions are simply:

```text
the first 24 encountered.
```

But candidate query order is not guaranteed.

So:

- different execution plans;
- new rows;
- different database ordering;

can potentially change which themes are even considered.

For broad libraries, themes after the first 24 disappear completely from the portrait space.

This is a P0 correctness issue.

---

# 55. Signature Problem: Theme Handling Disagrees With the Rest of the Card

Signature candidates use raw theme keyword matching without the stoplist.

The archetype/taste signal pipeline uses the stoplist.

So:

```text
Archetype says the title is not Theme X.
Signature algorithm says it is Theme X.
```

This makes the card capable of contradicting itself.

---

# 56. Signature Problem: `themeKey` Is Passed In and Ignored

The archetype's winning theme is passed into `pickSignatureFilms()`.

The function never reads it.

The surrounding comment implies the signature set should have a fallback connection to the named archetype.

That behavior does not exist.

Therefore the card can say:

```text
Nightcrawler
```

while all four Signature posters contain no meaningful noir/crime evidence.

That is a direct contract violation between two major identity surfaces.

---

# 57. Signature Problem: Missing Metadata Changes Identity

No poster:

```text
cannot be Signature.
```

No IMDb vote count:

```text
scores zero in all reach dimensions.
```

No embedding yet:

```text
skips duplicate guard.
```

These are not user taste facts.

They are metadata-pipeline states.

An identity card should not change because:

- TMDB hydrated a poster;
- IMDb votes arrived;
- the overnight embedding job finally processed a title.

Metadata completeness should affect **confidence**, not silently rewrite taste.

---

# 58. Signature Problem: Reach Handling Is Inconsistent

Other parts of the card can use a fallback similar to:

```text
IMDb votes
or TMDB vote count × factor
```

Signature facets use raw IMDb vote count.

Missing IMDb votes therefore mean:

```text
not famous
not mid-reach
not niche
```

simultaneously.

“Unknown” is being encoded as “belongs to no category.”

That distorts the target.

---

# 59. Signature Problem: The Rewatch Bonus Changes Every Film When One Rewatch Exists

Before the first rewatch:

```text
affection may effectively be entirely conviction.
```

After one film anywhere is rewatched:

```text
every candidate gains a rewatch dimension.
```

All single-viewing films now receive zero on a 0.55-weight component.

So one rewatch event can substantially reorder the entire candidate set.

That is too discontinuous.

Rewatch should be an additive bonus or a smoothly calibrated signal, not a library-wide scoring regime switch.

---

# 60. Signature Problem: Review Presence Has the Same Regime-Switch Problem

The first review anywhere activates review presence as an affection dimension for every title.

Now every unreviewed favourite receives a lower maximum affection score.

Writing one review changes the scoring meaning of every other movie.

That is a platform-usage artifact.

---

# 61. Signature Problem: Rewatch Weight Can Beat Much Higher Rating Conviction

The current weights allow a moderately high-rated film with several rewatches to beat a user's strongest-rated single-watch title.

That can be intentional.

But the effect is much larger than a “rewatch bonus.”

The product needs to explicitly decide:

> Is rewatch evidence more important than rating conviction?

Right now that decision is encoded accidentally by weights.

---

# 62. Signature Problem: The 0.15 Baseline Keeps Weak Titles in the Portrait Target

Every candidate contributes to the target with:

```text
0.15 + affection.
```

Even weakly liked titles shape the target.

The system intentionally does this so the target does not become pure favorites.

But it contributes to the contradiction:

> the target includes broad shelf composition while selection is restricted to favorites.

---

# 63. Signature Problem: Affection and Coverage Are Not on Stable Comparable Scales

The score adds:

```text
affection
+
0.6 × coverage gain.
```

But those quantities have very different distributions.

Coverage is largest early and naturally shrinks as the set fills.

So:

- early picks care more about portrait coverage;
- later picks increasingly collapse back toward affection/rating.

The semantic meaning of each slot therefore changes simply because of greedy sequence position.

---

# 64. Signature Problem: The Algorithm Is Greedy and Path-Dependent

The first selected portrait title changes which title is optimal next.

Greedy selection can be perfectly reasonable for performance.

But because there is no documented local-search refinement after selection, an early locally good choice can force weaker later compensation.

This matters more because the objective already has unstable dimensions.

The bigger issue is not “greedy is bad.”

It is:

> the greedy algorithm is optimizing a flawed target.

---

# 65. Signature Problem: Director and Primary-Theme Penalties Are Large Relative to Candidate Differences

Penalties:

```text
-0.25 repeated director
-0.15 repeated primary theme
```

Among top-decile favorites, affection scores may be tightly compressed.

So these fixed penalties can dominate meaningful differences.

A user whose identity genuinely revolves around one director may have that fact artificially suppressed.

The system correctly uses penalties rather than hard bans, but their scale still needs calibration.

---

# 66. Signature Problem: `primaryTheme` Is the Rarest Theme, Not Necessarily the Main Theme

The title's primary theme is chosen as its rarest matched cluster.

Rare does not necessarily mean central.

It can be:

- incidental;
- metadata noise;
- one minor plot element.

Yet that value drives redundancy penalty.

So diversity can be enforced based on a potentially incidental label.

---

# 67. Signature Problem: Embedding Availability Is Asynchronous

A title with an embedding can be penalized as a franchise duplicate.

A title without one cannot.

Therefore two identical libraries can produce different Signature sets depending on whether the overnight embedding job has finished.

Again:

> infrastructure state is leaking into identity.

---

# 68. Signature Problem: The Embedding Is Not a General Semantic Solution

The current implementation correctly admits that the embedding catches obvious franchise-near-duplicates but does not reliably capture broader thematic similarity.

For example, works that humans might consider spiritually similar can score below the duplicate threshold.

That is fine if the embedding is treated as a sequel guard.

It should not be assumed to solve semantic diversity.

---

# 69. Signature Problem: Captions Explain One Facet, Not the Whole Selection

A title can be selected because of a combination of:

- affection;
- coverage;
- director penalty;
- theme penalty;
- duplicate penalty.

But the caption reports whichever single facet closed the most weighted gap.

That can oversimplify the actual reason.

A user may reasonably infer:

> “This is here because it is non-English.”

when non-English was only one small part of the selection score.

---

# 70. Signature Problem: Rewatch Captions Override the Actual Selection Reason

If the user watched a title enough times, the caption becomes:

```text
The one you go back to.
```

even if the title was actually selected because it covered another important part of the portrait.

This makes the explanation more emotionally satisfying but less faithful to the algorithm.

The system should distinguish:

```text
why selected
```

from:

```text
interesting supporting evidence.
```

---

# 71. Signature Problem: Some Caption Language Overclaims the Data

Examples such as:

```text
“Only 3,412 people have rated it anywhere.”
```

are stronger than the underlying data source can justify.

IMDb vote count is not “anywhere.”

Likewise:

```text
“The subtitled one”
```

equates non-English origin with how the user watched it.

They may have watched a dub.

Identity explanations should not claim facts the system does not know.

---

# 72. Signature Problem: Film/Series Balance Is Applied After Optimization

This means the final set is no longer the set produced by the portrait objective.

The system:

1. optimizes;
2. checks format share;
3. mutates the answer afterward.

If format representation matters, it should be part of the objective.

If it does not matter, it should not overwrite an optimized result.

---

# 73. Signature Problem: The Balance Swap Chooses Replacements by Raw Rating

The replacement title is selected by raw rating.

This bypasses:

- conviction normalization;
- coverage;
- affection;
- distinctiveness;
- portrait logic.

So a TV-heavy user can end up with multiple slots effectively chosen by top-rating logic:

- anchor;
- balance replacement.

That weakens the entire portrait idea.

---

# 74. Signature Problem: The Swap Removes the Last-Picked Title, Not Necessarily the Weakest

The code comment and behavior disagree.

The comment says the weakest selection is replaced.

The implementation replaces the last-picked title of the over-represented type.

Those are not equivalent.

This is a direct code correctness problem.

---

# 75. Signature Problem: Balance Captions Describe the Algorithm Instead of the Person

Example:

```text
“Your shelf is part television, so one of these four is.”
```

That is not a taste explanation.

It tells the user:

> the system forced this title onto your card to satisfy a quota-like rule.

A Signature caption should explain why **that specific title** is signature-worthy.

---

# 76. Signature Problem: The Under-10 Path Is Visually and Semantically Weak

For fewer than 10 candidates:

- top four ratings;
- alphabetical ties;
- identical explanation language.

That creates a polished card with placeholder-quality logic.

A better low-data state would show:

- fewer Signature slots;
- provisional status;
- explicit “still forming” treatment.

---

# 77. Signature Problem: The Candidate Model Is Inconsistent With Tenpoint's New Media Model

The broader system recognizes three title kinds:

```text
movie
season
show
```

But Signature candidate documentation primarily describes:

```text
movie
season
```

This raises a product question:

> Should a Master Taste Card show an individual TV season or a whole series?

A signature identity card should probably use:

```text
movie
whole show
```

while season ratings provide evidence for the show.

The current abstraction has not fully caught up to the Shows expansion.

---

# 78. Signature Problem: Poster Availability Should Be a Rendering Concern, Not an Identity Concern

A defining title should remain defining even if poster metadata is missing.

Possible fallback rendering:

- text tile;
- backdrop;
- generated color treatment;
- delayed image hydration.

The algorithm should not remove a title from identity solely because the UI cannot currently render its poster.

---

# 79. Signature Problem: The System Calls the Feature “Portrait” but Optimizes Demographic Metadata

Era, reach, and language can be interesting.

But they are largely descriptors of:

> where and when media comes from.

The most identity-rich questions are usually:

- what themes;
- what emotional experiences;
- what storytelling styles;
- what narrative structures;
- what kinds of characters;
- what moods.

The current portrait has the weighting almost reversed.

---

# 80. Signature Problem: The Archetype and Signature Set Do Not Share a Canonical Taste Representation

This is the architectural root problem.

Archetype:

```text
cluster lift from taste-card signals
```

Signature Films:

```text
separate raw keyword cluster set
+ independent 32-D portrait
```

Taste Match:

```text
49-theme affinity vector
```

Theme DNA:

```text
cluster lift
```

These systems are related, but not all computed from one canonical user taste vector.

That is why dead `themeKey`, stoplist differences, and contradictory outputs can exist.

The redesign should produce one canonical Taste Profile and make every downstream system consume it.

---

# 81. Taste Match Still Uses the Old Theme Ontology

Taste Match combines:

```text
65% rating agreement
35% theme affinity
```

The theme affinity is built on the same 49-cluster system.

So every weakness in the theme ontology also affects social compatibility.

---

# 82. Taste Match Uses a Hard 5-Title Overlap Gate

At five common titles, rating agreement suddenly becomes 65% of the result.

Four titles:

```text
affinity carries the figure.
```

Five titles:

```text
a tiny overlap sample now dominates.
```

That is a sharp regime change.

Agreement confidence should scale gradually with overlap size.

---

# 83. Taste Match Can Mean Different Things at the Same Displayed Value

With no overlap:

```text
the score is affinity.
```

With enough overlap:

```text
the score is mostly rating agreement.
```

Those are different constructs.

The system does provide basis text, which is good.

But the primary social number can still look directly comparable when its evidence basis is very different.

---

# 84. Taste Match Is Still Potentially Film-First

The documentation repeatedly describes:

> films you've both rated.

Now that shows and seasons are first-class, the match system needs an explicit cross-media definition.

Questions include:

- compare whole shows?
- compare season ratings?
- collapse seasons?
- how does an anime season compare to a film?
- should shared show evidence carry different confidence?

This needs a first-class media-aware design.

---

# 85. The Product Doctrine and Taste-Match Direction Conflict

The product rules say:

> no numeric fit percentage or compatibility figure should be rendered.

But Taste Match is explicitly a blended quantitative compatibility measure.

If Tenpoint wants a social:

```text
86% Taste Match
```

feature, this doctrine needs revision.

The product should not maintain conflicting philosophies in code and design docs.

---

# 86. The Binder Is Collectible Even Though the Card Is Supposedly Not an Engagement Loop

The binder tracks:

```text
yours
held
unheld
```

for finishes.

That is inherently collectible.

Again, collectibility is not bad.

It just needs to be acknowledged and designed intentionally.

---

# 87. Variant History Is Preserved, but More Meaningful Identity History Is Not

The system stores previous visual finishes.

But archetype only shows the current state.

Signature history is not described as persisted.

From a user perspective, these are more interesting:

```text
what my archetype used to be
how my signatures changed
how my taste evolved
```

than:

```text
which gradient stock I used to hold.
```

The persistence priorities are backwards.

---

# 88. The Documentation Has Significant Drift

Stale comments include wrong counts for:

- traits;
- themes;
- milestone conditions;
- modifier words;
- variant axes;
- archetype logic;
- TV trait proportion.

There are also stale comments about:

- theme fallback behavior that does not exist;
- balance swapping the weakest pick when it actually swaps the last pick.

For a system this complex, stale documentation is dangerous because future fixes will be made against an incorrect mental model.

---

# 89. Dead Parameters and Dead Code Indicate Architecture Drift

Examples:

```text
themeKey passed but never read
36 unreachable fallback nouns
dead prevalence fallback
```

These are not just cleanup items.

They show that the system's conceptual contracts have changed faster than the architecture.

---

# 90. Metadata Hydration Is Too Visible in User Identity

Across the system, calculations depend on whether metadata happens to exist:

- poster;
- IMDb votes;
- embeddings;
- keyword hydration;
- runtime;
- language;
- creator data.

Evidence gates are good.

But the system should represent:

```text
unknown
```

as unknown.

It should not convert missing data into:

- zero;
- absence;
- ineligibility;
- a different identity.

---

# 91. The System Has Become Patch-Driven

The current implementation contains fixes for earlier fixes:

- shrinkage because rare themes ran away;
- near-tie rules because prevalence noise flipped nouns;
- stoplists because keyword noise corrupted clusters;
- RESTATES because modifier/noun combinations repeated;
- TV nouns because film clusters missed television;
- fixed priors because live priors would move identities;
- `cur_work` because seasons duplicated creators;
- embedding penalties because director/theme penalties missed franchises;
- media swaps because the portrait objective ignored format;
- generic swap captions because swapped titles lost their original role.

Each patch makes local sense.

Together they indicate the core model is no longer simple enough to trust.

---

# 92. Mathematical Defensibility Has Become More Important Than User Truth

A lot of the system can explain:

> why this number was calculated.

But the more important question is:

> does the result feel true to the person?

A statistically defensible “signature” that the user looks at and says:

> “Why is that movie there?”

has failed.

The card's primary quality metric should be:

```text
recognition
```

not merely internal consistency.

---

# 93. The System Needs One Canonical Definition of Taste

Right now different subsystems use different interpretations:

```text
Archetype → unusual theme frequency
Modifier → most extreme library axis
Traits → cumulative thresholds
Personality → descriptive partitions
Signature → affection-weighted demographic portrait
Taste Match → theme residuals + rating overlap
```

There is no single object that means:

> “This is Muhaimin's taste.”

That should be the core redesign.

Everything should derive from one normalized Taste Profile.

---

# 94. What Should Be Preserved

Despite the problems, several ideas are strong enough to keep.

## Keep: Nothing Manually Selected

The card should continue to feel discovered rather than configured.

## Keep: Relative Rating Conviction

Normalize enthusiasm against the user's own rating behavior.

## Keep: Evidence Gates

Do not make claims without enough evidence.

## Keep: Shrinkage / Confidence for Rare Patterns

Small samples should not dominate.

## Keep: Season-Level Ratings

They enable genuinely unique long-form traits.

## Keep: `cur_work`-Style Deduplication Principle

Do not let one long-running series multiply creator/theme evidence artificially.

## Keep: Affection Outside the Facet Vector

Do not force Signature Titles to average toward the user's average rating.

## Keep: Soft Redundancy Penalties

Do not ban same-director/theme selections.

## Keep: Narrow Embedding Duplicate Guard

Useful for obvious franchise duplication.

## Keep: Value + Explanation From the Same Function

This is one of the best engineering rules in the entire system.

## Keep: Privacy-Aware Computation

Private diary data must not leak through identity explanations.

## Keep: Taste Match Combining Agreement and Affinity

The high-level idea is strong even though the implementation should change.

---

# 95. What Should Be Rebuilt Rather Than Patched

These should be treated as architectural replacements:

```text
Count-based rarity progression
Milestone promotion logic
Modifier × noun combinatorial archetype
49-cluster binary keyword identity model
108-noun fallback system
RESTATES blacklist
Trait rung system
Arbitrary stock/accent/aura identity labels
Fixed 4:1 media currency as a universal concept
Current Signature Films portrait vector
Post-hoc film/series balance
Theme-based Taste Match built separately from archetype
```

---

# 96. Priority Order

## P0 — Correctness

Fix immediately if the current system remains live:

1. Make Signature candidate ordering deterministic.
2. Stop selecting the first arbitrary 24 themes.
3. Apply the same keyword normalization/stoplist everywhere.
4. Fix missing IMDb reach handling.
5. Either use or remove `themeKey`.
6. Fix `balance()` so behavior matches its comment.
7. Remove metadata-hydration state from core eligibility where possible.
8. Fix stale documentation that describes nonexistent behavior.

## P1 — Product Integrity

1. Redefine what rarity/progression means.
2. Separate whole-show opinion from season evidence.
3. Decide whether Signature slots represent movies + whole shows or movies + seasons.
4. Remove arbitrary visual semantics.
5. Separate identity traits from achievements.
6. Make low-data cards explicitly provisional.
7. Make TV/anime first-class in the semantic model.

## P2 — Taste Model Rebuild

1. Build one canonical affection-weighted Taste Profile.
2. Separate exposure from preference.
3. Replace binary keyword themes with weighted semantic dimensions.
4. Rebuild archetype from the canonical profile.
5. Rebuild traits as observational findings.
6. Rebuild Signature Titles from the same profile.
7. Rebuild Taste Match from the same profile.
8. Add model versioning and identity stability rules.

---

# 97. The Core Redesign Principle

Every visible element should pass this test:

> **Does this reveal something new and meaningful about the person's taste, or is it simply another way of counting, decorating, or restating something already visible?**

If it is counting:

> move it to stats or milestones.

If it is decoration:

> make it silent visual styling.

If it repeats another signal:

> remove it.

If it genuinely reveals identity:

> keep it.

---

# Final Assessment

The current system is not bad because it lacks sophistication.

It is bad in places **because it has too much sophistication distributed across too many separate definitions of taste**.

The strongest next move is not to add another correction layer.

It is to collapse the system around one canonical model:

```text
RAW VIEWING DATA
        ↓
NORMALIZED EVIDENCE
        ↓
CANONICAL TASTE PROFILE
        ↓
┌────────────┬────────────┬──────────────┬────────────┐
│ Progress   │ Archetype  │ Traits       │ Signatures │
└────────────┴────────────┴──────────────┴────────────┘
        ↓
TASTE CARD + TASTE MATCH
```

The mathematics can remain complex underneath.

The user's experience should become dramatically simpler, more coherent, and more believable.
