CREATE INDEX "films_rt_score_idx" ON "films" USING btree ("rt_score");--> statement-breakpoint
CREATE INDEX "films_imdb_rating_idx" ON "films" USING btree ("imdb_rating");