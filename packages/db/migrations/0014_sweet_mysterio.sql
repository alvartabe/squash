ALTER TABLE "player_profiles" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_junior" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "player_profiles_username_unique" ON "player_profiles" USING btree ("username");