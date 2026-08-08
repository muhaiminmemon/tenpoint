# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a **deep-catalogue viewer**: someone who watches far more
than a few titles a month, logs festival films and obscure horror alongside the
canon, follows series season by season, and rewatches deliberately. They almost
always arrive with an existing history to import rather than an empty account,
and they care that 8.7 is a different verdict from 8.5.

**Anime viewers are a named audience, not a side case.** They arrive from
MyAnimeList rather than Letterboxd, and they already think in the unit this
product stores — a score per season, not one verdict per series. Anime is
handled as a *kind of show* (`shows.form`: `anime` / `animation` /
`live_action`) rather than a separate media type, so it needs no parallel
product surface and must never be given one.

Their job is to **keep an honest, permanent record of what they watched and what
they actually thought** — precise enough to be worth trusting years later — and
to settle "what should we watch" with a friend without an algorithm pretending to
understand taste better than the two of them do.

The consequence for design: density and precision serve this user better than
hand-holding. A popularity cutoff, a five-star scale, or a feed that ranks the
people they know would each fail them specifically.

## Product Purpose

Tenpoint is a diary for **film and television** where **ratings mean something**:
a 1.0–10.0 scale in tenths, one row per *viewing* rather than per title, and a
rewatch history that stays honest. It exists because the incumbent's five-star
scale flattens real distinctions, because its rewatch model loses the record of
how an opinion changed, and because it has no unit of opinion for television at
all.

**Film and television are peers here, not a primary and a secondary.** A season
is stored as a row in `films` alongside movies — same diary, same watchlist,
same lists, same embeddings, same recommender — because a season is the same
kind of thing a film is: something watched on a date, rated once, and argued
about. Nothing downstream needed a parallel code path, and nothing downstream
should grow one.

Success is a user whose Tenpoint library is a record they'd defend — accurate
enough that they reach for it instead of their memory, and precise enough that
the ordering of their top 50 is genuinely theirs.

## Positioning

**"Ratings that mean something."** The positioning is stated as what this product
*is*, not what it beats. An earlier line named a competitor directly; naming one
is legally fine — describing what you compete with is nominative fair use — but
it makes the other product the subject of your own first sentence, and a reader
has to know them to understand us. The scale is the argument, and anyone
arriving from a five-star app recognises what it answers without being told.
See `src/lib/brand.ts`. The trademark disclaimer in `/terms` still names them
deliberately: it exists to disclaim a relationship, and cannot do that job
without saying whose.

Four mechanisms a neighbouring product could not truthfully copy without
rebuilding:

- **Ratings are tenths stored as integers.** `diary_entries.rating` is a
  `smallint` of tenths (`8.7` → `87`). No floating-point arithmetic touches a
  rating anywhere upstream of render, so decimals never drift or round
  unpredictably. Conversion to a float happens once, in `src/lib/format.ts`.
- **One row per viewing, current rating derived.** A title's rating is *the most
  recent entry that has a rating*, computed in one SQL query in
  `src/lib/library.ts`, so an unrated rewatch cannot erase a real rating.
- **The season is the unit of opinion for television, and completion has three
  states.** A season is rated like a film; a series may also be rated whole, and
  doing both credits the *larger* reading, never the sum. `SeriesState` is
  `finished` / `caughtup` / `unfinished` (`src/lib/series-progress.ts`) because
  "completed" was quietly two things: finishing something that has ended is
  permanent, while finishing something still airing lapses the moment a new
  season lands, through no act of the viewer's. A card must never change its
  mind about something the reader already did.
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

- **Arrival is an import, not an empty state.** The realistic first session is an
  export of hundreds to ~900 rows, run through a four-step pipeline (parse →
  match → preview/correct → commit) with per-row manual re-search for anything
  TMDB missed, and a full undo. Design work on first-run must assume the import
  path is the main one.
- **Two supported export formats, and they arrive differently.** Letterboxd
  hands out CSV (`ratings.csv`, `diary.csv`, `watched.csv`, `watchlist.csv`) and
  its stars carry over doubled — 4★ becomes 8.0. MyAnimeList hands out gzipped
  XML whose ids refer to MAL's own catalogue, translated to TMDB through a map
  built by `scripts/build-mal-map.ts`; MAL scores are whole numbers out of ten,
  so a 7 is a 7.0 and the conversion loses nothing, but a 0 means *unrated*
  rather than terrible. Either source can be imported **without** its ratings,
  bringing the watch record and leaving the verdicts to be formed here.
- **Sessions are long and repetitive.** Logging, rating, and reordering happen
  dozens of times in a sitting; the rating dial and drag-to-reorder are the
  hot paths.
- **Both phone and desktop are real.** The app ships a bottom nav, sheets that
  rise on mobile and slide over from the right on desktop, and a command
  palette that becomes a sheet under 640px.
- **The friend pair is a first-class unit.** Friendship is one canonical sorted
  row, giving every pair-scoped feature a stable `pairKey`; recommendations and
  the shared "what should we watch" list both key off it.
- **Catalogue metadata comes from TMDB on demand**, cached lazily per title
  rather than pre-cached as a popular top-N — a deliberate consequence of who the
  user is. Attribution is required: "This product uses the TMDB API but is not
  endorsed or certified by TMDB."
- **Critic scores come from OMDb, on a separate clock.** Tomatometer,
  Metacritic, and IMDb rating/votes are stored per film *and per season*, joined
  by `imdbId` taken from TMDB's own response and never inferred from a title — a
  wrong id is worse than a missing one, because OMDb answers a bad id with a real
  title's scores rather than an error. `scoresRefreshedAt` is tracked separately
  from `refreshedAt`.

## Capabilities and Constraints

Confirmed and shipped: diary logging with per-viewing entries, tenths ratings,
reviews with independent `spoiler` and `private` flags, a ranked library with
drag-to-reorder within rating ties, watchlist, favourites, collaborative lists
with `owner`/`editor`/`viewer` roles, friends and invites, blocks, reports with
an admin queue, a strictly chronological friends feed with no ranking, public
profiles with `public`/`friends`/`private` visibility, Letterboxd and
MyAnimeList import with idempotent re-upload and undo, full JSON export with no
paywall gate, avatars, email verification, and password reset.

**Television — confirmed and first-class.** A `shows` table groups seasons that
live as rows in `films` under `kind`: `movie` | `season` | `show`, where the
`show` row stands for the whole series. Shipped: series pages with a season
list, a series shelf carrying the three completion states, rating a show whole
or season by season, season rewatch and removal, seasons queued to the
watchlist, search that answers with films and series ranked together, a browse
toggle between the two, and a recommender scoped to `all` / `movie` / `show`.

- **A bare season is never recommended**, whichever way the filter is set.
  "Watch Breaking Bad season three" is not an answer to *what should we watch*
  for anyone who hasn't seen the first two. The whole-series row says the thing
  a person actually means. Seasons stay rateable and still feed the taste that
  drives everything; they are just not the unit anybody is told to go start.
- **Season-level scores are kept apart on purpose.** TMDB scores Breaking Bad
  season one and season five separately, and printing one number for both would
  flatten exactly the distinction this product exists to show. `audienceRating`
  is per row, not per show.
- **The series shelf answers a question the library cannot.** A library lists one
  row per rated title, so a viewer of The Simpsons occupies thirty-eight rows and
  still cannot see whether they finished it. Series progress is computed at the
  grain of the series, in one query.

**Critic scores and community boards — confirmed and durable.** Film and season
pages show external critic scores; `getGlobalTopRated` ranks the catalogue by a
shrinkage-weighted community mean — each title's mean pulled toward the global
mean in proportion to how little evidence stands behind it, with `m` set to the
75th percentile of ratings-per-title so it tracks the size of the crowd rather
than freezing as a constant. Private entries are excluded, and only each
person's *current* rating counts.

**The no-ranking rule scopes to people, not to the catalogue.** Ranked boards
are permitted over the shared catalogue — that is discovery. They are never
permitted over people, over friends, or over a user's own library, which is
theirs to order. The friends feed stays strictly chronological.

**Taste card — confirmed feature.** A card derived entirely from real signals:
six rarity tiers, an "any three of six" milestone set, an algorithmic archetype
(era × leading genre, never chosen, with two-word combining titles and its own
nouns for television), four hidden variant axes (stock/edge/accent/aura read
from dominant genre, rating spread, highest-rated decade, and overall mean), and
eighteen traits. Its constraints are part of the feature:

- Nothing on the card is *selected* by the user; every value is read from their
  actual taste, and it is re-read whenever taste changes.
- Milestone targets are facts about what was watched (count, breadth,
  curation), never time elapsed in the app — a bulk import lands exactly where
  the same taste logged natively would.
- **Television counts, weighed by seasons rather than rows.** The card carries
  its own counters — seasons credited, shows touched, longest run, completed
  shows, fell-off and grew counts, anime seasons — because finishing a series or
  watching one fall apart are not things a film can do. Rating a series whole
  credits all its seasons; rating some credits those; doing both credits the
  larger, never the sum, so a whole-show rating is not priced at one film. A
  series must not count as many titles in the archetype denominator.
- No "X% of filmgoers hold this" rarity percentages. With a small user base that
  number is meaningless or absent, not a genuine signal. The condition text is
  the reward.
- Traits are never announced beyond a quiet dot on the card front; they list
  only on the back or in the popup.

**Terminology:** *entry* (one viewing), *current rating* (the derived one),
*tenths* (the storage unit), *pair* / `pairKey`, *tier*, *trait*, *archetype*,
*variant*. For television: *series* or *show* (the whole thing), *season* (the
unit of opinion), *whole-series rating*, *credited seasons*, and the three
states *finished* / *caught up* / *unfinished*. Prefer *title* over *film* where
a statement covers both media. Ratings display as one decimal, always (`8.0`,
not `8`); counts that mix the two say what they count rather than calling
everything films.

**Technical constraints that bind design work:**

- Server components read the database directly; every mutation goes through a
  route handler under `src/app/api/`. Nothing in `lib/` may import from
  `components/` or `app/`.
- Single replica, pinned. The rate limiter keeps counters in process memory.
- Ratings must never pass through floating-point arithmetic before display.
- A rating is never required to log a viewing.
- No numeric recommendation score, fit percentage, or compatibility figure may
  be rendered.
- `films.tmdbId` is **not** unique on its own — TMDB numbers movies and seasons
  in separate spaces, so uniqueness is on the `(kind, tmdbId)` pair. Anything
  resolving a title by TMDB id must carry the kind with it.
- Television is not a separate media type in the data model, and anime is not a
  separate media type from television. Neither may be given a parallel product
  surface.

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
- Tagline, as shipped: *"A film diary with ratings that mean something."*
  (`APP_TAGLINE`). **Open:** this and `APP_DESCRIPTION` still say *film diary*,
  written before television became a peer. Whether the tagline should be
  restated to cover both media is undecided and is a naming decision, not a
  design one — do not silently reword it.
- Positioning line: *"Ratings that mean something."* (`APP_POSITIONING`). The
  earlier *"A better Letterboxd"* line was retired; a competitor is named only
  in the `/terms` trademark disclaimer, where naming them is the point.
- **The name must not be built out of a competitor's coined mark.** An earlier
  working name used `-boxd` and was changed before launch. Any future naming,
  wordmark, or campaign work inherits this constraint.
- Voice: plain, specific, unhyped. The product explains its own reasoning in
  real numbers rather than superlatives; error and gate states say exactly which
  thing is short and by how much, never "try again later."
- Assets: logo and imagery in `public/`. Posters — film and series alike — are
  user-facing colour and come from TMDB.

## Evidence on Hand

- **Pre-launch. No real users outside the author.** There are no testimonials,
  case studies, press mentions, user counts, ratings-volume figures, uptime
  claims, or reviews. Future work must not fabricate any of these, and must not
  imply an existing community.
- Real and citable: the working product itself, the `README.md` engineering
  record, twenty-two tables in `src/db/schema.ts`, and two real import paths —
  Letterboxd and MyAnimeList — each demonstrable with an actual export.
- Verified in testing (author's own, not third-party): two full imports of the
  same `diary.csv` added zero duplicate rows; two consecutive recommendation
  requests returned zero overlapping titles.
- The seeded crowd is **synthetic** — accounts generated to exercise the
  catalogue, including television-led ones. It is a development fixture and must
  never be cited or displayed as evidence of real usage.
- Deployment target is Railway; `tenpoint.site` is the intended domain.

## Product Principles

1. **Precision is the product.** Anything that rounds, flattens, or approximates
   a user's judgment — a five-star scale, a stored average, a float — is a
   regression, not a simplification.
2. **The record is honest or it is worthless.** Every viewing is kept; no
   later action silently rewrites an earlier opinion. Deletion and export are
   real, immediate, and unpaywalled.
3. **Never imply precision the system doesn't have.** Show rank, not score;
   show a true reason, not a generated one. A number on screen is a promise —
   including a community mean, which is why it is weighted by how much evidence
   stands behind it rather than shown raw.
   **Corollary:** rank the catalogue freely; never rank people. A board over
   titles is discovery. A board over friends, or over someone's own library, is
   a scoreboard.
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
