-- What a viewing's rating used to be, before its owner changed their mind.
--
-- Correcting a score is neither a rewatch nor nothing. Editing an entry
-- overwrote the rating in place and destroyed the earlier opinion; the season
-- list avoided that by writing a second diary row, which made a correction read
-- as another viewing. The viewing now stays one viewing, and each rating it
-- carried before this one is kept here.
--
-- Rows hold the rating being REPLACED, so the entry's own column is always the
-- current one and the full progression is these rows plus it.
CREATE TABLE IF NOT EXISTS "entry_rating_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entry_id" uuid NOT NULL REFERENCES "diary_entries"("id") ON DELETE cascade,
  "rating" smallint NOT NULL,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entry_rating_history_entry_idx" ON "entry_rating_history" ("entry_id","changed_at");
