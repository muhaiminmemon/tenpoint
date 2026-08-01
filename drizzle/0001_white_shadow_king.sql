CREATE TABLE "card_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"season" text NOT NULL,
	"season_label" text NOT NULL,
	"rated" integer NOT NULL,
	"level" integer NOT NULL,
	"tier" text NOT NULL,
	"archetype" text,
	"variant_name" text,
	"accent_color" text,
	"stamped_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_seasons" ADD CONSTRAINT "card_seasons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_seasons_user_season_uq" ON "card_seasons" USING btree ("user_id","season");