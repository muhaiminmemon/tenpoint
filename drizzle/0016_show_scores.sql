ALTER TABLE "shows" ADD COLUMN IF NOT EXISTS "vote_average" smallint;
ALTER TABLE "shows" ADD COLUMN IF NOT EXISTS "imdb_id" text;
