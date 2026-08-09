-- The signature quartet as it stands, and the record of what moved.
--
-- `signature_sets` is one row per user: the incumbent that the next computation
-- is compared against, so a title cannot be knocked off by a challenger that
-- beats it by a hair. `signature_history` is one row per genuine change.
CREATE TABLE IF NOT EXISTS "signature_sets" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "titles" jsonb NOT NULL,
  "set_score" double precision NOT NULL,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signature_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "removed" jsonb NOT NULL,
  "added" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signature_history_user_idx" ON "signature_history" ("user_id","created_at");
