CREATE TYPE "public"."tournament_entry_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."tournament_invitation_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."tournament_participation_source" AS ENUM('entry-request', 'invitation', 'direct');--> statement-breakpoint
CREATE TYPE "public"."tournament_visibility" AS ENUM('club-only', 'public');--> statement-breakpoint
UPDATE "tournaments" SET "seeding_method" = 'manual' WHERE "seeding_method" = 'ranking';--> statement-breakpoint
ALTER TYPE "public"."seeding_method" RENAME TO "seeding_method_old";--> statement-breakpoint
CREATE TYPE "public"."seeding_method" AS ENUM('random', 'manual');--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "seeding_method" TYPE "public"."seeding_method" USING "seeding_method"::text::"public"."seeding_method";--> statement-breakpoint
DROP TYPE "public"."seeding_method_old";--> statement-breakpoint
CREATE TABLE "tournament_entry_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"player_id" text NOT NULL,
	"status" "tournament_entry_request_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" text
);
--> statement-breakpoint
CREATE TABLE "tournament_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"player_id" text NOT NULL,
	"invited_by_id" text NOT NULL,
	"status" "tournament_invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tournament_participations" (
	"tournament_id" uuid NOT NULL,
	"player_id" text NOT NULL,
	"seed" integer,
	"source" "tournament_participation_source" NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_by_id" text,
	CONSTRAINT "tournament_participations_tournament_id_player_id_pk" PRIMARY KEY("tournament_id","player_id")
);
--> statement-breakpoint
DROP TABLE "tournament_registrations" CASCADE;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "visibility" "tournament_visibility";--> statement-breakpoint
UPDATE "tournaments" SET "visibility" = 'club-only' WHERE "visibility" IS NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "visibility" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "draft_draw_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tournament_entry_requests" ADD CONSTRAINT "tournament_entry_requests_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entry_requests" ADD CONSTRAINT "tournament_entry_requests_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entry_requests" ADD CONSTRAINT "tournament_entry_requests_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_invitations" ADD CONSTRAINT "tournament_invitations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_invitations" ADD CONSTRAINT "tournament_invitations_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_invitations" ADD CONSTRAINT "tournament_invitations_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participations" ADD CONSTRAINT "tournament_participations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participations" ADD CONSTRAINT "tournament_participations_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participations" ADD CONSTRAINT "tournament_participations_accepted_by_id_users_id_fk" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tournament_entry_requests_tournament_status_idx" ON "tournament_entry_requests" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_entry_requests_pending_idx" ON "tournament_entry_requests" USING btree ("tournament_id","player_id") WHERE "tournament_entry_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "tournament_invitations_tournament_status_idx" ON "tournament_invitations" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_invitations_pending_idx" ON "tournament_invitations" USING btree ("tournament_id","player_id") WHERE "tournament_invitations"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "registration_closes_at";
