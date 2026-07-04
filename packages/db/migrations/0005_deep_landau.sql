CREATE TYPE "public"."membership_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "membership_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"player_id" text NOT NULL,
	"status" "membership_request_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" text,
	CONSTRAINT "membership_requests_resolution_check" CHECK (("membership_requests"."status" = 'pending' and "membership_requests"."resolved_at" is null and "membership_requests"."resolved_by_id" is null)
        or ("membership_requests"."status" <> 'pending' and "membership_requests"."resolved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "membership_requests" ADD CONSTRAINT "membership_requests_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_requests" ADD CONSTRAINT "membership_requests_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_requests" ADD CONSTRAINT "membership_requests_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_requests_club_status_submitted_idx" ON "membership_requests" USING btree ("club_id","status","submitted_at");--> statement-breakpoint
CREATE INDEX "membership_requests_player_idx" ON "membership_requests" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_requests_one_pending_idx" ON "membership_requests" USING btree ("club_id","player_id") WHERE "membership_requests"."status" = 'pending';