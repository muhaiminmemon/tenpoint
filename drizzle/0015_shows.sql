CREATE TABLE IF NOT EXISTS "shows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tmdb_id" integer UNIQUE,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "first_air_year" integer,
  "last_air_year" integer,
  "status" text,
  "poster_path" text,
  "backdrop_path" text,
  "overview" text,
  "original_language" text,
  "genres" jsonb,
  "keywords" jsonb,
  "cast_names" jsonb,
  "creators" jsonb,
  "season_count" integer,
  "episode_count" integer,
  "form" text,
  "popularity" double precision,
  "vote_count" integer,
  "refreshed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "films" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'movie' NOT NULL;
ALTER TABLE "films" ADD COLUMN IF NOT EXISTS "show_id" uuid REFERENCES "shows"("id");
ALTER TABLE "films" ADD COLUMN IF NOT EXISTS "season_number" integer;
ALTER TABLE "films" ADD COLUMN IF NOT EXISTS "episode_count" integer;

-- TMDB numbers movies and seasons separately, so movie 550 and season 550 are
-- different objects. The old single-column unique would have collided them.
ALTER TABLE "films" DROP CONSTRAINT IF EXISTS "films_tmdb_id_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "films_kind_tmdb_uq" ON "films" ("kind","tmdb_id");
CREATE INDEX IF NOT EXISTS "films_show_idx" ON "films" ("show_id");
