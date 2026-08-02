import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  boolean,
  timestamp,
  date,
  jsonb,
  doublePrecision,
  uniqueIndex,
  index,
  primaryKey,
  serial,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  bio: text("bio"),
  /**
   * Permanent signup-order badge — the taste card's "No. ####". Assigned
   * once via a sequence and never recomputed, so it can't shift if an
   * earlier account is later deleted; a live COUNT(*)-based rank would.
   */
  memberNumber: serial("member_number").notNull().unique(),
  /**
   * Version stamp for the avatar, not the image itself. The bytes live in
   * `avatars`, so no query that joins `users` ever drags a blob along, and
   * `/api/avatar/[userId]?v=<stamp>` can be cached immutably forever: a new
   * upload bumps the stamp, which changes the URL.
   */
  avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  // public | friends | private
  privacy: text("privacy").notNull().default("public"),
  // who may comment on their reviews: anyone | friends | off
  commentPermission: text("comment_permission").notNull().default("friends"),
  // whether these sections appear on the PROFILE page for non-owners;
  // the owner always sees everything of their own regardless of these
  showDiaryOnProfile: boolean("show_diary_on_profile").notNull().default(true),
  showWatchlistOnProfile: boolean("show_watchlist_on_profile").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * Avatar bytes, one row per user, deliberately in their own table: a profile
 * or feed query joins `users` dozens of times and must never pull image data
 * with it. Read only by `/api/avatar/[userId]`.
 */
export const avatars = pgTable("avatars", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  mimeType: text("mime_type").notNull(),
  // base64 payload without the data-URL prefix
  data: text("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Single-use email tokens for verification and password reset. Stored as a
 * SHA-256 hash for the same reason sessions are: a database leak must not
 * hand out working links.
 */
export const emailTokens = pgTable(
  "email_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // verify | reset
    kind: text("kind").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_tokens_user_idx").on(t.userId, t.kind)],
);

export const films = pgTable("films", {
  id: uuid("id").primaryKey().defaultRandom(),
  tmdbId: integer("tmdb_id").unique(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  year: integer("year"),
  /**
   * TMDB's earliest release date. `year` alone cannot answer "is it out yet"
   * for anything releasing later in the current year, and this is usually the
   * festival premiere rather than general release — so a film someone genuinely
   * saw at a festival is already dated in the past and stays loggable.
   */
  releaseDate: date("release_date"),
  /**
   * ISO 639-1, straight from TMDB. Stored so the language filter works against
   * the local catalogue too: without it, choosing a critic ranking silently
   * dropped a filter the reader had set, which is worse than not offering it.
   */
  originalLanguage: text("original_language"),
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  director: text("director"),
  runtime: integer("runtime"),
  genres: jsonb("genres").$type<string[]>(),
  castNames: jsonb("cast_names").$type<string[]>(),
  keywords: jsonb("keywords").$type<string[]>(),
  popularity: doublePrecision("popularity"),
  voteCount: integer("vote_count"),
  overview: text("overview"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }),

  /**
   * The join key to everything outside TMDB, taken from TMDB's own
   * `/movie/{id}` response and never inferred from a title.
   *
   * A wrong id here is worse than a missing one: OMDb answers a bad id with a
   * real film's scores rather than an error, so the page would show a
   * confident, plausible rating belonging to something else entirely.
   */
  imdbId: text("imdb_id"),

  /** 0–100, the Tomatometer as OMDb reports it */
  rtScore: smallint("rt_score"),
  /** 0–100 */
  metacritic: smallint("metacritic"),
  /**
   * IMDb's average in tenths (8.8 → 88), the same unit a rating is stored in
   * everywhere else here, so nothing about it reaches a float before display.
   */
  imdbRating: smallint("imdb_rating"),
  imdbVotes: integer("imdb_votes"),
  /** separate from `refreshedAt`: scores come from a different source, on a different clock */
  scoresRefreshedAt: timestamp("scores_refreshed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // The critic leaderboards order by these and page through them; without an
  // index every page is a full scan of the whole catalogue.
  index("films_rt_score_idx").on(t.rtScore),
  index("films_imdb_rating_idx").on(t.imdbRating),
]);

/**
 * One row per viewing. Historical ratings never change; a film's current
 * rating is derived from the most recent *rated* entry.
 * `rating` is stored in tenths: 10..100 for 1.0..10.0. Null = watched, no rating.
 */
export const diaryEntries = pgTable(
  "diary_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id),
    watchedOn: date("watched_on"),
    rating: smallint("rating"),
    review: text("review"),
    spoiler: boolean("spoiler").notNull().default(false),
    private: boolean("private").notNull().default(false),
    rewatch: boolean("rewatch").notNull().default(false),
    importId: uuid("import_id"),
    // idempotency key for imported rows; null for manual entries
    sourceKey: text("source_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("diary_source_key_uq").on(t.userId, t.sourceKey),
    index("diary_user_film_idx").on(t.userId, t.filmId),
  ],
);

export const imports = pgTable("imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filenames: jsonb("filenames").$type<string[]>(),
  // previewed | committed | undone
  status: text("status").notNull().default("previewed"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  committedAt: timestamp("committed_at", { withTimezone: true }),
});

/** Manual secondary order among films tied on the same rating. */
export const libraryOrder = pgTable(
  "library_order",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id),
    sortKey: doublePrecision("sort_key").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.filmId] })],
);

export const watchlist = pgTable(
  "watchlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id),
    // capture reason: who recommended it or where you saw it
    source: text("source"),
    // how much you want to get to it; drives the coloured dot in the queue
    priority: text("priority").$type<"urgent" | "soon" | "whenever">().notNull().default("whenever"),
    // manual queue order; lower sorts first, fractional so a drag needs one write
    position: doublePrecision("position").notNull().default(0),
    importId: uuid("import_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("watchlist_user_film_uq").on(t.userId, t.filmId)],
);

/**
 * A favourite is a separate signal from a rating: a 7.2 you'd rewatch tonight
 * belongs here, a technically-perfect 9.1 you never revisit does not.
 */
export const favourites = pgTable(
  "favourites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("favourites_user_film_uq").on(t.userId, t.filmId)],
);

/** Mutual friendship, one row per pair; ids stored low/high so the pair is unique. */
export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userLowId: uuid("user_low_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userHighId: uuid("user_high_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("friendship_pair_uq").on(t.userLowId, t.userHighId)],
);

/** Pending friend requests; accepting creates the mutual friendship. */
export const friendRequests = pgTable(
  "friend_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromId: uuid("from_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toId: uuid("to_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("friend_request_uq").on(t.fromId, t.toId)],
);

/** Shareable invite links; accepting one creates a mutual friendship. */
export const invites = pgTable("invites", {
  token: text("token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-user recommendation feedback: seen (watched but never logged) or not interested. */
export const userFilmFlags = pgTable(
  "user_film_flags",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id),
    // seen | not_interested
    flag: text("flag").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.filmId, t.flag] })],
);

/** Outcome tracking per pair, per film: shown, saved, dismissed, seen. */
export const recEvents = pgTable(
  "rec_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pairKey: text("pair_key").notNull(),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    event: text("event").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rec_events_pair_idx").on(t.pairKey, t.event)],
);

export const lists = pgTable("lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  // set for the auto-created shared list of a friend pair
  pairKey: text("pair_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const listMembers = pgTable(
  "list_members",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // owner | editor | viewer
    role: text("role").notNull().default("viewer"),
  },
  (t) => [primaryKey({ columns: [t.listId, t.userId] })],
);

export const listItems = pgTable(
  "list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    position: doublePrecision("position").notNull().default(0),
    // why this film is on the list, written by whoever added it
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("list_items_uq").on(t.listId, t.filmId)],
);

/** Comments on reviews (diary entries that have review text). */
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => diaryEntries.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_entry_idx").on(t.entryId)],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // user | review | comment
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  reason: text("reason").notNull(),
  // open | resolved | dismissed
  status: text("status").notNull().default("open"),
  resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Every `users` column except `passwordHash`.
 *
 * Prefer this over a bare `select()` on `users` anywhere the row travels
 * further than the one function verifying a password: a hash that is never
 * read cannot be logged, serialised into an RSC payload, or leaked by a future
 * `JSON.stringify` on something that happens to hold it. Adding a column to
 * `users` means adding it here too, which is the intended friction.
 */
export const safeUserColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  email: users.email,
  bio: users.bio,
  memberNumber: users.memberNumber,
  avatarUpdatedAt: users.avatarUpdatedAt,
  emailVerifiedAt: users.emailVerifiedAt,
  privacy: users.privacy,
  commentPermission: users.commentPermission,
  showDiaryOnProfile: users.showDiaryOnProfile,
  showWatchlistOnProfile: users.showWatchlistOnProfile,
  createdAt: users.createdAt,
};

/**
 * Every finish a user has ever held.
 *
 * A variant is derived from current taste, not collected, so a person holds
 * exactly one at a time and the one they held a year ago is otherwise
 * unrecoverable. Without this table the binder could only ever say "one yours,
 * twenty-nine not", which is a diagram rather than a collection.
 *
 * A set, deliberately, not a timeline: first-held is kept because it is free,
 * but nothing here records an order, a duration, or a lapse. Written on the
 * same pass that builds the card, which is the cheapest place that already
 * knows the answer.
 */
export const heldVariants = pgTable(
  "held_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** the finish's printed name, e.g. "Filmstrip Gold" */
    variantName: text("variant_name").notNull(),
    firstHeldAt: timestamp("first_held_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("held_variants_user_variant_uq").on(t.userId, t.variantName)],
);

export type HeldVariant = typeof heldVariants.$inferSelect;

export type User = typeof users.$inferSelect;
/**
 * What `getSessionUser()` returns: every column except the password hash,
 * which has no business travelling with the viewer on every render.
 * A full `User` is still assignable wherever this is accepted.
 */
export type SessionUser = Omit<User, "passwordHash">;
export type Film = typeof films.$inferSelect;
export type DiaryEntry = typeof diaryEntries.$inferSelect;
