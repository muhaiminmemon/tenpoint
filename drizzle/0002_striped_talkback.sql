-- A plain "serial" ADD COLUMN would number existing rows in whatever order
-- Postgres happens to scan them in during the table rewrite, not the order
-- they actually signed up in. Add it as a nullable integer first, backfill
-- by created_at, then wire up a sequence for every row from here on.
ALTER TABLE "users" ADD COLUMN "member_number" integer;--> statement-breakpoint
UPDATE "users" SET "member_number" = ranked.rn
FROM (SELECT "id", row_number() OVER (ORDER BY "created_at" ASC, "id" ASC) AS rn FROM "users") AS ranked
WHERE "users"."id" = ranked."id";--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "users_member_number_seq" OWNED BY "users"."member_number";--> statement-breakpoint
SELECT setval('users_member_number_seq', (SELECT COALESCE(MAX("member_number"), 0) FROM "users"));--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "member_number" SET DEFAULT nextval('users_member_number_seq');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "member_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_member_number_unique" UNIQUE("member_number");
