ALTER TABLE "films" ADD COLUMN "imdb_id" text;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "rt_score" smallint;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "metacritic" smallint;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "imdb_rating" smallint;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "imdb_votes" integer;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "scores_refreshed_at" timestamp with time zone;