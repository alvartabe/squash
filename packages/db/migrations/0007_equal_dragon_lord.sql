CREATE TYPE "public"."attendance_response" AS ENUM('going', 'not-going');--> statement-breakpoint
DELETE FROM "matches" WHERE "source" = 'open-play';--> statement-breakpoint
ALTER TABLE "open_play_matches" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "open_play_matches" CASCADE;--> statement-breakpoint
ALTER TABLE "open_play_attendees" RENAME TO "club_play_session_participants";--> statement-breakpoint
ALTER TABLE "open_play_sessions" RENAME TO "club_play_sessions";--> statement-breakpoint
ALTER TABLE "club_play_session_participants" RENAME COLUMN "status" TO "response";--> statement-breakpoint
ALTER TABLE "club_play_session_participants" ALTER COLUMN "response" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "club_play_session_participants" ALTER COLUMN "response" TYPE "public"."attendance_response" USING (
  CASE "response"::text
    WHEN 'accepted' THEN 'going'::"public"."attendance_response"
    WHEN 'declined' THEN 'not-going'::"public"."attendance_response"
    ELSE NULL
  END
);--> statement-breakpoint
ALTER TABLE "club_play_sessions" RENAME COLUMN "organizer_id" TO "coordinator_id";--> statement-breakpoint
ALTER TABLE "club_play_session_participants" DROP CONSTRAINT "open_play_attendees_session_id_open_play_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "club_play_session_participants" DROP CONSTRAINT "open_play_attendees_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "club_play_sessions" DROP CONSTRAINT "open_play_sessions_club_id_clubs_id_fk";
--> statement-breakpoint
ALTER TABLE "club_play_sessions" DROP CONSTRAINT "open_play_sessions_organizer_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "open_play_club_date_idx";--> statement-breakpoint
ALTER TABLE "club_play_session_participants" DROP CONSTRAINT "open_play_attendees_session_id_user_id_pk";--> statement-breakpoint
ALTER TABLE "club_play_session_participants" ADD CONSTRAINT "club_play_session_participants_session_id_user_id_pk" PRIMARY KEY("session_id","user_id");--> statement-breakpoint
ALTER TABLE "club_play_session_participants" ADD COLUMN "invited_by_id" text;--> statement-breakpoint
ALTER TABLE "club_play_session_participants" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "club_play_session_participants" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "club_play_sessions" ADD COLUMN "cancelled_by_id" text;--> statement-breakpoint
ALTER TABLE "club_play_sessions" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "club_play_session_participants" ADD CONSTRAINT "club_play_session_participants_session_id_club_play_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."club_play_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_play_session_participants" ADD CONSTRAINT "club_play_session_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_play_session_participants" ADD CONSTRAINT "club_play_session_participants_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_play_sessions" ADD CONSTRAINT "club_play_sessions_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_play_sessions" ADD CONSTRAINT "club_play_sessions_coordinator_id_users_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_play_sessions" ADD CONSTRAINT "club_play_sessions_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_play_sessions_club_date_idx" ON "club_play_sessions" USING btree ("club_id","starts_at");--> statement-breakpoint
ALTER TABLE "club_play_sessions" DROP COLUMN "time_zone";--> statement-breakpoint
ALTER TYPE "public"."match_source" RENAME TO "match_source_old";--> statement-breakpoint
CREATE TYPE "public"."match_source" AS ENUM('challenge', 'tournament');--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "source" TYPE "public"."match_source" USING "source"::text::"public"."match_source";--> statement-breakpoint
DROP TYPE "public"."match_source_old";--> statement-breakpoint
DROP TYPE "public"."attendance_status";
