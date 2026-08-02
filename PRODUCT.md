# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a **deep-catalogue cinephile**: someone who watches far more
than a few films a month, logs festival titles and obscure horror alongside the
canon, and rewatches deliberately. They almost always arrive with an existing
Letterboxd history to import rather than an empty account, and they care that
8.7 is a different verdict from 8.5.

Their job is to **keep an honest, permanent record of what they watched and what
they actually thought** — precise enough to be worth trusting years later — and
to settle "what should we watch" with a friend without an algorithm pretending to
understand taste better than the two of them do.

The consequence for design: density and precision serve this user better than
hand-holding. A popularity cutoff, a five-star scale, or a feed that ranks
anything would each fail them specifically.

## Product Purpose

Tenpoint is a film diary where **ratings mean something**: a 1.0–10.0 scale in
tenths, one row per *viewing* rather than per film, and a rewatch history that
stays honest. It exists because the incumbent's five-star scale flattens real
distinctions and because its rewatch model loses the record of how an opinion
changed.

Success is a user whose Tenpoint library is a record they'd defend — accurate
enough that they reach for it instead of their memory, and precise enough that
the ordering of their top 50 is genuinely theirs.

## Positioning

**"A better Letterboxd."** The comparison is the pitch and lives in body copy,
never in the trademark (see `src/lib/brand.ts` for why: describing a competitor
is nominative fair use; building a brand out of their coined mark is not).

Three mechanisms a neighbouring product could not truthfully copy without
rebuilding:

- **Ratings are tenths stored as integers.** `diary_entries.rating` is a
  `smallint` of tenths (`8.7` → `87`). No floating-point arithmetic touches a
  rating anywhere upstream of render, so decimals never drift or round
  unpredictably. Conversion to a float happens once, in `src/lib/format.ts`.
- **One row per viewing, current rating derived.** A film's rating is *the most
  recent entry that has a rating*, computed in one SQL query in
  `src/lib/library.ts`, so an unrated rewatch cannot erase a real rating.
- **Every recommendation carries a true plain-English reason, and no score is
  ever shown.** Friend recommendations score the *minimum* of the two people's
  percentiles, never the mean, so a film one person would love and the other
  would hate scores low on purpose. "More like this" on a film page ranks by a
  learned similarity between films, computed overnight and stored, but the line
  under each poster is always a fact a reader could check for themselves: the
  shared director, the shared face, the two keywords both films carry. Rank
  order communicates strength without implying precision the system doesn't
  have, so no percentage, match figure or score is rendered anywhere.

## Operating Context

- **Arrival is an import, not an empty state.** The realistic first session is a
  Letterboxd CSV export of hundreds to ~900 rows, run through a four-step
  pipeline (parse → match → preview/correct → commit) with per-row manual
  re-search for anything TMDB missed, and a full undo. Design work on
  first-run must assume the import path is the main one.
- **Sessions are long and repetitive.** Logging, rating, and reordering happen
  dozens of times in a sitting; the rating dial and drag-to-reorder are the
  hot paths.
- **Both phone and desktop are real.** The app ships a bottom nav, sheets that
  rise on mobile and slide over from the right on desktop, and a command
  palette that becomes a sheet under 640px.
- **The friend pair is a first-class unit.** Friendship is one canonical sorted
  row, giving every pair-scoped feature a stable `pairKey`; recommendations and
  the shared "what should we watch" list both key off it.
- **Film metadata comes from TMDB on demand**, cached lazily per film rather
  than pre-cached as a popular top-N — a deliberate consequence of who the user
  is. Attribution is required: "This product uses the TMDB API but is not
  endorsed or certified by TMDB."

## Capabilities and Constraints

Confirmed and shipped: diary logging with per-viewing entries, tenths ratings,
reviews with independent `spoiler` and `private` flags, a ranked library with
drag-to-reorder within rating ties, watchlist, favourites, collaborative lists
with `owner`/`editor`/`viewer` roles, friends and invites, blocks, reports with
an admin queue, a strictly chronological friends feed with no ranking, public
profiles with `public`/`friends`/`private` visibility, Letterboxd import with
idempotent re-upload and undo, full JSON export with no paywall gate, avatars,
email verification, and password reset.

**Taste card — confirmed feature.** A card derived entirely from real signals:
six rarity tiers on films rated, an "any three of six" milestone set, an
algorithmic archetype (era × leading genre, never chosen), four hidden variant
axes (stock/edge/accent/aura read from dominant genre, rating spread,
highest-rated decade, and overall mean), and eighteen traits. Its constraints
are part of the feature:

- Nothing on the card is *selected* by the user; every value is read from their
  actual taste, and it is re-read whenever taste changes.
- Milestone targets are facts about the films (count, breadth, curation), never
  time elapsed in the app — a bulk Letterboxd import lands exactly where the
  same taste logged natively would.
- No "X% of filmgoers hold this" rarity percentages. With a small user base that
  number is meaningless or absent, not a genuine signal. The condition text is
  the reward.
- Traits are never announced beyond a quiet dot on the card front; they list
  only on the back or in the popup.

**Terminology:** *entry* (one viewing), *current rating* (the derived one),
*tenths* (the storage unit), *pair* / `pairKey`, *tier*, *trait*, *archetype*,
*variant*. Ratings display as one decimal, always (`8.0`, not `8`).

**Technical constraints that bind design work:**

- Server components read the database directly; every mutation goes through a
  route handler under `src/app/api/`. Nothing in `lib/` may import from
  `components/` or `app/`.
- Single replica, pinned. The rate limiter keeps counters in process memory.
- Ratings must never pass through floating-point arithmetic before display.
- A rating is never required to log a viewing.
- No numeric recommendation score, fit percentage, or compatibility figure may
  be rendered.

**Explicit non-goals, still binding:** no AI chatbot, no LLM-generated reviews
or blurbs, no streaming availability, no watch-party/sync, no compatibility
percentages or visible fit scores, no pairwise comparison prompts, no streaks,
no public follower counts, no push notifications, no native apps. The taste card
is not an exception to the badge exclusion — it is an identity artifact derived
from taste, not an engagement loop, and it must stay one.

**Undecided:** nothing about monetisation, pricing, or licensing has been
established. Export deliberately has no paywall gate in the code, so there is
nothing to remove later if that stays true.

## Brand Commitments

- Name **Tenpoint**, lowercase wordmark `tenpoint`, domain `tenpoint.site`.
  Every user-visible mention resolves through `src/lib/brand.ts` — never hardcode
  the name in a component, page, email, or export filename.
- Tagline: *"A film diary with ratings that mean something."*
- Positioning line: *"A better Letterboxd."* Body copy only, never the mark.
- **The name must not be built out of a competitor's coined mark.** An earlier
  working name used `-boxd` and was changed before launch. Any future naming,
  wordmark, or campaign work inherits this constraint.
- Voice: plain, specific, unhyped. The product explains its own reasoning in
  real numbers rather than superlatives; error and gate states say exactly which
  thing is short and by how much, never "try again later."
- Assets: logo and imagery in `public/`. Film posters are user-facing colour and
  come from TMDB.

## Evidence on Hand

- **Pre-launch. No real users outside the author.** There are no testimonials,
  case studies, press mentions, user counts, ratings-volume figures, uptime
  claims, or reviews. Future work must not fabricate any of these, and must not
  imply an existing community.
- Real and citable: the working product itself, the `README.md` engineering
  record, twenty-one tables in `src/db/schema.ts`, and a real Letterboxd import
  path that can be demonstrated with an actual export.
- Verified in testing (author's own, not third-party): two full imports of the
  same `diary.csv` added zero duplicate rows; two consecutive recommendation
  requests returned zero overlapping films.
- Deployment target is Railway; `tenpoint.site` is the intended domain.

## Product Principles

1. **Precision is the product.** Anything that rounds, flattens, or approximates
   a user's judgment — a five-star scale, a stored average, a float — is a
   regression, not a simplification.
2. **The record is honest or it is worthless.** Every viewing is kept; no
   later action silently rewrites an earlier opinion. Deletion and export are
   real, immediate, and unpaywalled.
3. **Never imply precision the system doesn't have.** Show rank, not score;
   show a true reason, not a generated one. A number on screen is a promise.
4. **Say the specific thing.** Gates, errors, and empty states name what is
   missing and by how much. No vague reassurance.
5. **Earn attention with taste, not mechanics.** Recognition may reflect what
   someone has actually watched; it may never manufacture a reason to return.

## Accessibility & Inclusion

No formal audited standard is committed. Preserve the reflexes already in the
code as a floor: visible focus rings on every interactive element
(`:focus-visible`, 2px beam, 2px offset), a full `prefers-reduced-motion` block
that disables every named animation and collapses transitions, real text
contrast against the graphite surfaces, and tabular numerals wherever ratings
column up.

Known gap, not yet owed work: the interface is dark-only
(`color-scheme: dark`), with no light theme.
