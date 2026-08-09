-- The highest tier an account has ever earned.
--
-- Rank thresholds move when the depth formula is re-fitted, and a rank already
-- shown to somebody is not taken back. `tier_floor` records the high-water mark
-- so the effective tier can be the greater of the two.
--
-- Backfilled from `tier` rather than recomputed: `tier` is what each account was
-- last told it held, which is exactly the promise being kept. Accounts that were
-- never synced have no promise to keep and stay null.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tier_floor" text;--> statement-breakpoint
UPDATE "users" SET "tier_floor" = "tier" WHERE "tier" IS NOT NULL AND "tier_floor" IS NULL;
