# Tenpoint

**A better Letterboxd.**

A film diary with ratings that mean something. Log what you watch, rate it on a
1.0–10.0 scale in tenths, keep your rewatch history honest, and find something
to watch with a friend, without pretending an algorithm understands taste
better than it does.

### On the name

The comparison to Letterboxd is the pitch, and it lives in the copy — the
landing page, the auth screens, this README. It is deliberately *not* the
trademark.

Describing yourself as an alternative to a competitor is nominative fair use
and is protected. Building your brand out of their coined mark is neither, and
`-boxd` is Letterboxd's own invention, which is the category of mark that gets
the strongest protection. An earlier working name did exactly that; the rename
happened before launch rather than after, on the theory that the moment you'd
be forced to change it is the moment it costs the most.

Every user-visible mention of the name comes from `src/lib/brand.ts`, so the
next rename is one file.

## Stack

- Next.js 16 (App Router) + TypeScript, server components by default
- Tailwind CSS 4
- PostgreSQL via Drizzle ORM (`pg_trgm` for fuzzy title search)
- TMDB for all film metadata, fetched on demand and cached
- No ML, no embeddings, no vector search, no LLM calls anywhere, including
  in the recommender, which is metadata scoring, on purpose (see below)

## Running locally

```sh
npm install
cp .env.example .env.local   # fill in DATABASE_URL and TMDB_API_KEY
docker compose up -d          # local Postgres, or use Supabase/Neon/Railway
npm run db:migrate            # enables pg_trgm + applies migrations
npm run dev
```

Get a free TMDB API key at https://www.themoviedb.org/settings/api. Only
`DATABASE_URL` and `TMDB_API_KEY` are needed to run locally; everything else in
`.env.example` is optional or production-only. With no `RESEND_API_KEY` set,
verification and password-reset emails are printed to the server console
instead of sent, so the full signup flow works with zero mail configuration.

### Changing the schema

Edit `src/db/schema.ts`, then:

```sh
npm run db:generate   # writes a new SQL file into ./drizzle
npm run db:migrate    # applies anything pending
```

Migrations are committed, reviewed, and run once in order. This deliberately
replaces `drizzle-kit push`, which diffs the schema against the live database
and alters it to match: harmless on an empty dev database, and a data-loss
event once real rows exist, because a renamed column reads as a drop plus an
add. CI fails the build if `schema.ts` changes without a matching migration.

---

## Architecture overview

```
src/
  app/                  routes (App Router), one folder per URL segment
    api/                route handlers; every mutation goes through one of these
    [username]/          public profile
    film/[slug]/          film page (rating, log, reviews, timeline)
    watch/[a]/[b]/         "what should we watch?" for a friend pair
    ...
  components/           client + server components, one file per UI concern
  lib/                  framework-free business logic, the actual product
  db/
    schema.ts            every table, as Drizzle definitions
    index.ts             lazy singleton db client (works without a DB at build time)
```

The rule of thumb throughout: **pages read from the database directly** (they're
server components, no client-side fetch waterfall for initial data), and
**every write goes through an API route** under `src/app/api/`, called from a
small client component. Nothing in `lib/` imports from `components/` or `app/`;
it's the layer that would survive a full frontend rewrite.

---

## Data model

Twenty-one tables, all in `src/db/schema.ts`. The two that matter most:

```
films            one row per film, keyed to TMDB's id
diary_entries    one row per viewing, not per film
```

Everything else hangs off those two: `watchlist`, `library_order`,
`friendships`/`friend_requests`/`invites`, `blocks`, `lists`/`list_members`/
`list_items`, `comments`, `user_film_flags`, `rec_events`, `reports`.

### Why "one row per viewing," not "one row per film"

A user can watch the same film five times across ten years with five
different opinions. `diary_entries` stores every one of them; a film's
**current rating** is derived, never stored, computed as *the most recent
entry that has a rating*, so an unrated rewatch does not erase the last real
rating:

```
2023 → 8.2      (rated)
2024 → watched, no rating
2026 → 9.1      (rated)  ← current: 9.1

2023 → 8.2      (rated)
2024 → watched, no rating          ← current: 8.2, NOT unrated
```

This derivation lives in one place, `src/lib/library.ts`, as a single SQL
query rather than application code, so the library page and every profile
page compute it identically:

```sql
with rated as (
  select distinct on (film_id) film_id, rating
  from diary_entries
  where user_id = :userId and rating is not null
  order by film_id, watched_on desc nulls last, created_at desc
),
stats as (
  select film_id, count(*) as entry_count, max(watched_on) as last_watched
  from diary_entries where user_id = :userId group by film_id
)
select f.*, r.rating, s.entry_count, s.last_watched, o.sort_key
from stats s
join films f on f.id = s.film_id
left join rated r on r.film_id = s.film_id
left join library_order o on o.user_id = :userId and o.film_id = s.film_id
order by r.rating desc nulls last, coalesce(o.sort_key, 0) asc, f.title asc
```

`distinct on (film_id) ... order by watched_on desc nulls last, created_at desc`
is doing the actual "most recent rated entry" logic. Postgres picks exactly
one row per film, the latest by watch date (falling back to insert order for
undated entries), and only from rows where `rating is not null`. An unrated
entry with a later date simply isn't in the `rated` CTE, so it can't win.

### Ratings are integers, not floats

`diary_entries.rating` is a `smallint`, storing **tenths**: `1.0` is `10`,
`8.7` is `87`, `10.0` is `100`. Every comparison, sort, and aggregate in the
codebase (the library ranking, the recommender's per-user mean, the CSV
import conversion) operates on these integers. The only place a rating
becomes a float is `src/lib/format.ts`, at the last possible moment, for
display: `formatTenths(87) → "8.7"`. This is why decimals never drift or
round unpredictably: there's no floating-point arithmetic on ratings anywhere
upstream of the render.

### Ties and manual order

The library sorts by rating descending. Films tied on the same rating keep a
user-chosen order from `library_order.sort_key` (a float, so inserting between
two films is a cheap midpoint write, not a renumbering pass), set by
drag-and-drop in `LibraryView.tsx` via `@dnd-kit`. Ties are computed
client-side (consecutive films with equal `rating` after the SQL sort) and
only the *tied group* is made a drag context, so dragging can't accidentally
reorder across a rating boundary.

### Friendship is a single canonical row, not two

`friendships` stores `(user_low_id, user_high_id)`, the two user ids sorted
so `(a, b)` and `(b, a)` are always the same row (`src/lib/social.ts`,
`pairIds`). This makes "are these two friends" a single indexed lookup with no
directionality bugs, and gives every pair-scoped feature (recommendations,
shared lists) a stable `pairKey`, the same sorted-pair string, to key off of.
Friend requests (`friend_requests`) are directional and separate; accepting
one deletes the request row and inserts the canonical friendship row.
Asking someone who already asked you skips the request entirely and
friends you immediately (`api/friends/request/route.ts`).

---

## Request lifecycle & auth

Sessions are opaque random tokens (`node:crypto randomBytes`, not JWTs, so no
client-side claims to keep in sync with server state). `src/lib/auth.ts`
hashes the token with SHA-256 before storing it in the `sessions` table
(so a DB leak doesn't hand out live session tokens) and sets it as an
`httpOnly`, `sameSite=lax` cookie. Passwords are hashed with `scrypt`
(Node's built-in, no dependency), salted per-user, stored as `salt:hash` hex.

Every server component that needs the current user calls
`getSessionUser()`, which is a single indexed join (`sessions` → `users`):
cheap enough to call at the top of every page without a separate auth
middleware layer. It selects an explicit column list (`SessionUser`, every
column *except* `passwordHash`) rather than the whole row, so the password
hash never travels with the viewer on a render. Route handlers call the same
function and return `401` if it's null; there is no separate authorization
framework, just an `if` at the top of each handler in
`src/app/api/**/route.ts`.

CSRF needs no token layer here: the session cookie is `sameSite=lax`, so it
isn't sent on cross-site POSTs, and every mutation is a JSON body that a
cross-origin form can't produce without a preflight.

A failed sign-in for a username that doesn't exist still runs scrypt against a
dummy hash (`burnPasswordTiming`), so response latency can't be used to
enumerate which usernames are registered.

### Passwords, email, and accounts

- **Verification.** Signup issues a single-use token (SHA-256 hashed in
  `email_tokens`, 24h) and mails a link. Confirming is a `POST` from the
  landing page rather than a `GET` on the emailed URL, because corporate mail
  scanners follow links and a `GET` would let a scanner burn the token before
  the user ever clicked it.
- **What verification gates.** Not access. An unverified account can use
  everything private to it; it just isn't listed in user search and can't
  comment on other people's reviews. Signup is free, so being *findable* is the
  thing that should cost a working inbox.
- **Reset.** `POST /api/auth/forgot` answers identically whether or not the
  account exists — it's unauthenticated, so a distinguishable response would
  make it an account-enumeration oracle. Completing a reset destroys every
  session for that user; changing a password from Settings destroys every
  session *except* the current one.
- **Deletion.** `DELETE /api/account` needs the password and the username typed
  back. The work is done by `on delete cascade` on every table referencing
  `users.id`, so it can't drift from the schema. The one case cascade gets
  wrong is a shared list the user owns, which would take other people's work
  with it — those are handed to another member first.
- **Mail** goes through Resend over plain `fetch` (no SDK dependency). With no
  API key configured, `sendMail` logs the message instead, which is a mode and
  not an error: local development needs no mail setup.

### Rate limiting

`src/lib/ratelimit.ts` is a fixed-window counter in process memory, applied to
sign-in, signup, outbound email, recommendations, imports, search, and every
user-visible write. Deliberately not Redis: this runs as one long-lived Node
server, where an in-process map is exact and free. The tradeoff is that it
doesn't span replicas, so behind more than one instance the effective limit
multiplies by the replica count — still a hard ceiling per attacker rather than
none, and the swap to a shared store is confined to one function.

Limits that protect TMDB's quota rather than ours (`/api/recs`, which fans out
to ~17 TMDB calls) are keyed per account, not per IP.

### Moderation

Reports land in `reports` and are read at `/admin/reports`, gated on the
`ADMIN_USERNAMES` env allowlist (`src/lib/admin.ts`) — an env var rather than a
`users.role` column, because there is exactly one privileged action in this
product and a role column would mean a schema, a granting UI, and a way to
escalate. Non-admins get a `404`, not a `403`: the existence of the route isn't
worth advertising. `reports.subjectId` is a loose id rather than a foreign key,
so the queue renders "content no longer exists" for anything already deleted.

---

## Film catalogue strategy

The brief this was built against explicitly rejects pre-caching a fixed
top-N of popular films, because the target user logs festival titles and
obscure horror that a popularity cutoff would exclude. So the catalogue is
built lazily, in `src/lib/films.ts`:

- **`ensureFilm(movie)`** is called when a single TMDB search result is opened
  (e.g. clicking a film in search). Upserts a minimal row keyed on `tmdb_id`,
  handling the insert race with `onConflictDoNothing` + a re-select.
- **`hydrateFilm(film)`** is called when a film page is opened. If the film has
  no director yet, or its metadata is more than 30 days old, fetches full
  TMDB details (credits, keywords, runtime) and updates the row in place.
  Metadata is fetched once per film, not once per view.
- **`bulkEnsureFilms(movies)`** is called by the recommender, which pulls
  dozens of TMDB list results per run. Batches inserts (100 rows at a time),
  skips films already cached, and resolves insert-race losers with a
  follow-up `select ... where tmdb_id in (...)`.

Search (`src/app/api/search/route.ts`) queries TMDB live and merges in local
matches via `pg_trgm` similarity (`similarity(title, query) > 0.3`), so
typo-tolerant matching works even if TMDB's own search misses. If the TMDB
key is missing or the API is down, search silently falls back to local-only
results rather than failing the request.

---

## Letterboxd import

`src/lib/letterboxd.ts` parses whichever CSVs Letterboxd exports
(`diary.csv`, `ratings.csv`, `watched.csv`, `watchlist.csv`), detected by
header shape, not filename. Star ratings convert deterministically:
`stars × 20 = tenths` (so `4★ → 80 → "8.0"`, `3.5★ → 70 → "7.0"`).

The import is a four-step pipeline, each step its own API route, because a
900-row CSV can't be matched against TMDB inside one request without timing
out:

1. **`import/parse`** reads the CSV(s), stores the parsed rows as JSON on
   an `imports` row with `status: "previewed"`. Nothing touches `diary_entries`
   yet.
2. **`import/match`** is called by the client in a loop, 30 unique titles at
   a time (`mapLimit` caps concurrent TMDB calls at 8), writing matches back
   into the same `imports.payload`. `matchFilm()` checks the local cache
   first, then TMDB search, tolerating a one-year mismatch between
   Letterboxd's and TMDB's release year (festival vs. wide release is a
   common source of near-misses).
3. **Preview + correction**: the client shows every row with its matched
   poster; anything TMDB couldn't find gets a manual re-search UI
   (`MatchFixer` in `ImportWizard.tsx`), and unmatched titles can be
   individually skipped rather than blocking the whole import.
4. **`import/commit`** writes `diary_entries` (and `watchlist` rows) for
   real. **Idempotency** comes from `diary_entries.source_key`, a
   deterministic string built from `kind + letterboxd URI + watched date +
   rating` (`sourceKey()` in `letterboxd.ts`), with a unique index on
   `(user_id, source_key)`. Re-uploading the same file a second time hits
   that constraint on every row and inserts nothing new, verified in
   testing: two full imports of the same diary.csv, second one added zero
   rows. `ratings.csv` rows only fill in films with no rated diary entry
   already (it's meant to backfill, not duplicate); `watched.csv` rows only
   apply to films with no diary entry at all.

**Undo** (`import/undo`) deletes every `diary_entries`/`watchlist` row
tagged with that `import_id` and flips the import to `status: "undone"`. It
can be re-committed later, since the source rows are still sitting in
`imports.payload`.

---

## Recommendation engine: "What should we watch?"

Lives entirely in `src/lib/recs.ts`, called from `POST /api/recs`. No model,
no embeddings, no external AI call. That's deliberate, both because a
two-sided cold-start problem (a brand-new pair of users) has nothing for
collaborative filtering to train on, and because the product requires every
recommendation to come with a **true, plain-English reason**, which a
similarity score doesn't hand you for free.

**1. Eligibility gate.** Each person needs ≥20 films with a *current* rating
(same derivation as the library) and ≥5 of those ≥8.0. Below that, the
endpoint returns which person is short and by how much, never a vague
"try again later."

**2. Build a taste profile per person** (`buildProfile`). For every rated
film, `weight = (rating − their own mean) / 10`, so an 8.0 means something
different for someone whose average is 6 versus 8.5; everything is relative
to that person's own distribution, never an absolute threshold. Those
weights accumulate into five maps (genre, decade, director, cast, keyword),
with director/cast/keyword only pulled from films rated *above* the person's
mean (no point inferring "loves Fincher" from a film they were lukewarm on).
Each map is then normalized to its own max so a director someone has simply
watched a lot of can't out-rank one they truly love. Director metadata gets
lazily hydrated for a person's top 8 highest-rated films only, capping the
TMDB calls this step can trigger.

**3. Generate 500–2000 candidates, never score the whole catalogue**
(`gatherCandidates`). Pulls TMDB's top-rated and popular lists (5 pages),
then `discover`-by-genre for genres both people weight highly, then
`discover`-by-director for directors either person loves, merged with
whatever's already cached locally. This is the step most likely to be worth
extending later. TMDB's own `/movie/{id}/similar` and `/recommendations`
endpoints (its own collaborative filtering, running on TMDB's data, not
ours) would add a "people who liked X also liked Y" candidate source without
touching the no-ML constraint, since nothing is trained or hosted here.

**4. Filter.** Drop anything either person has any diary entry for (rated or
not), anything either flagged *already seen* or *not interested*
(`user_film_flags`), and anything without a poster.

**5. Score independently, then combine conservatively** (`rawScore`,
`scoreAll`). Each candidate gets a weighted sum per person:

```
1.6 × genre-match + 1.4 × director-match + 0.7 × decade-match
  + 0.6 × cast-match + 0.6 × keyword-match
  + 0.35 × popularity-signal + 0.25 (if already on their watchlist)
```

Raw scores are converted to **percentile rank within the current candidate
batch** (so two people's differently-scaled raw numbers become comparable),
then the pair's score is the **minimum of the two percentiles**, never the
arithmetic mean. A film one person would love and the other would hate
scores low on purpose; only films both people would independently rank
highly survive. (This is the one non-negotiable in the whole engine: an
arithmetic mean would happily recommend a 9/10-for-A, 3/10-for-B film at
6/10, which is the exact failure mode the brief called out.)

**6. Diversify** (`diversify`). Walks the ranked list top-down, capping at 2
films per director and 3 per primary genre until 5 are picked, which stops the
result from being five near-identical thrillers by the same director.

**7. Explain, from data, not a model** (`blurbFor`). A fixed priority chain:
already on a watchlist → shared loved director → two-or-more shared genres →
one shared genre → shared decade → generic fallback. Every blurb is a
template filled with real numbers pulled from the two profiles; there is no
free-text generation step, which is also why **no numeric score is ever
shown in the UI**. Rank order communicates strength without implying a
precision the model doesn't actually have.

**8. Memory** (`rec_events`). The 5 shown get logged for that pair. "Show
five more" excludes everything already shown; only once fewer than 5
unshown candidates remain does it clear the shown-list and start the
rotation over, verified in testing across two consecutive requests with
zero overlap.

**Feedback loop.** `POST /api/recs/feedback` handles three actions:
`save` (adds the film to the pair's shared list, auto-created on first
save, both people as members), `seen`, and `not_interested` (both write to
`user_film_flags`, permanently excluding the film from future runs for that
person). Every action (shown, saved, dismissed, seen) is written to
`rec_events`, so the outcome of every recommendation is traceable per pair,
per film.

---

## Collaborative lists

Three roles (`owner`, `editor`, `viewer`) stored per `(list, user)` in
`list_members` (`src/lib/lists.ts`). Ownership doesn't transfer implicitly;
`roleIn()` is checked at the top of every list-mutating route, and only an
owner can rename, delete, or manage membership. The pair's shared "what
should we watch" list is a `lists` row with a unique `pair_key`, the same
canonical pair string the recommender and friendship system use, so saving
a pick always lands in the same list instead of creating a new one per
session.

## Reviews, comments, and privacy

A review is just text on a `diary_entries` row, with two independent flags:
`spoiler` (client renders a "reveal" gate, doesn't withhold the data) and
`private` (excluded from every query that isn't the owner's own: library,
feed, film-page reviews, all filtered at the query level in
`ReviewsSection.tsx` and `getRankedLibrary`, not hidden client-side).
Comment permission (`anyone` / `friends` / `off`) is a per-user setting,
enforced in `api/comments/route.ts` before insert, and profile visibility
(`public` / `friends` / `private`) is centralized in
`canViewProfile()`, one function every profile-adjacent page calls, rather
than each page re-implementing the same three-way check.

## Feed

`src/app/feed/page.tsx` is one query: friends' diary entries, non-private,
newest first. No ranking, no "top" anything, since the brief calls for strictly
chronological, and that's the entire implementation.

## Export

`GET /api/export` is one route that joins diary entries, watchlist, and
every list the user belongs to into a single JSON document. No paywall gate
exists in the code at all, so there's nothing to remove later if that stays
true. It sits next to account deletion in Settings on purpose: the export is
the only copy anyone gets, and deletion is immediate and unrecoverable.

---

## Avatars

Profile photos are the one piece of user data big enough to matter on a hot
path, so they don't live on the user row. `avatars` holds the bytes, keyed by
user id; `users.avatarUpdatedAt` holds a timestamp and nothing else. Every
query that joins `users` — the feed, list members, review authors, and the
session lookup that runs on *every* render — reads the timestamp, never the
image.

`avatarSrc(userId, stamp)` turns that into `/api/avatar/<id>?v=<stamp>`, which
the route serves with `Cache-Control: immutable, max-age=1y`. Pinning it that
hard is safe precisely because the stamp is in the URL: a new upload writes a
new timestamp, which is a different URL, so a cached response can never be the
stale one. The image crosses the wire once per user per change instead of once
per row per query.

Uploads are validated server-side (`parseImageDataUrl`) and capped at 512 KB.
`image/svg+xml` is rejected along with everything else outside JPEG/PNG/WebP —
an SVG is a script-bearing document, and these are served from our own origin.

## Deploying

Beyond `DATABASE_URL` and `TMDB_API_KEY`:

| Variable | Why |
|---|---|
| `APP_URL` | Builds the links in verification and reset emails. Wrong value sends people to the wrong host. |
| `RESEND_API_KEY` | Without it, emails print to the console instead of sending. Fine locally, not in production. |
| `MAIL_FROM` | Must be a domain verified with Resend. |
| `ADMIN_USERNAMES` | Comma-separated; who can read `/admin/reports`. |
| `CONTACT_EMAIL` | Shown on `/privacy` and `/terms`. |

Run `npm run db:migrate` as part of the deploy, before the new build serves
traffic. `/api/recs` and `/api/import/match` declare `maxDuration = 60`, since
both comfortably exceed the 10s default a serverless platform gives a route
handler.

## Design system

Chrome is deliberately quiet. Film posters are the color, so the interface
around them stays near-neutral with one accent reserved for interactive
state only.

| Token | Hex | Role |
|---|---|---|
| carbon | `#141417` | page background |
| tray | `#1C1C21` | raised surfaces |
| seam | `#2A2A31` | borders |
| paper | `#ECEAE6` | primary text (and ratings, with no accent color on numbers) |
| ash | `#9A9AA3` | secondary text |
| beam | `#8FAECC` | interactive state only: focus, selection |

Type: Space Grotesk for display and numerals (`.num` forces
`font-variant-numeric: tabular-nums`, so decimal points align down a column,
`RatingHistogram`, the library ledger, and the diary all depend on this),
IBM Plex Sans for body text.

The signature interaction is the rating dial (`components/RatingDial.tsx`):
tap a whole number for the one-click path (`8` → `8.0`, done), refine with
the decimal strip beneath, or type `8.7` + Enter. Nothing here is a
90-position slider, and a rating is never required to log a viewing.

## Explicit non-goals

No AI chatbot, no LLM-generated reviews or blurbs, no streaming
availability, no watch-party/sync features, no compatibility percentages or
visible fit scores, no pairwise comparison prompts, no streaks/badges/public
follower counts, no push notifications or native apps. Each of these was a
deliberate exclusion, not an oversight. See `EXPLICIT NON-GOALS` in the
original product brief for the reasoning behind each.

Film data from [TMDB](https://www.themoviedb.org). This product uses the
TMDB API but is not endorsed or certified by TMDB.
