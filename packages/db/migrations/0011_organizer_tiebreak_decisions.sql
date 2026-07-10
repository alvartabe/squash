CREATE TYPE "public"."organizer_tiebreak_context" AS ENUM('group-standings', 'wildcard-cutoff', 'knockout-seeding');--> statement-breakpoint
CREATE TABLE "organizer_tiebreak_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"context" "organizer_tiebreak_context" NOT NULL,
	"group_id" uuid,
	"ordered_player_ids" jsonb NOT NULL,
	"requirement_key" text NOT NULL,
	"decided_by_id" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizer_tiebreak_group_context_check" CHECK (("organizer_tiebreak_decisions"."context" = 'group-standings' AND "organizer_tiebreak_decisions"."group_id" IS NOT NULL) OR ("organizer_tiebreak_decisions"."context" <> 'group-standings' AND "organizer_tiebreak_decisions"."group_id" IS NULL)),
	CONSTRAINT "organizer_tiebreak_player_order_check" CHECK (jsonb_typeof("organizer_tiebreak_decisions"."ordered_player_ids") = 'array' AND jsonb_array_length("organizer_tiebreak_decisions"."ordered_player_ids") >= 2)
);
--> statement-breakpoint
ALTER TABLE "organizer_tiebreak_decisions" ADD CONSTRAINT "organizer_tiebreak_decisions_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_tiebreak_decisions" ADD CONSTRAINT "organizer_tiebreak_decisions_group_id_tournament_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tournament_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_tiebreak_decisions" ADD CONSTRAINT "organizer_tiebreak_decisions_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organizer_tiebreak_requirement_idx" ON "organizer_tiebreak_decisions" USING btree ("tournament_id","requirement_key");