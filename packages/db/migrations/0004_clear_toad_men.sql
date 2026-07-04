CREATE TYPE "public"."club_responsibility" AS ENUM('owner', 'admin', 'coach');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'suspended', 'ended');--> statement-breakpoint
CREATE TABLE "club_responsibilities" (
	"club_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"responsibility" "club_responsibility" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_responsibilities_club_id_user_id_responsibility_pk" PRIMARY KEY("club_id","user_id","responsibility")
);
--> statement-breakpoint
ALTER TABLE "club_invitations" ADD COLUMN "responsibility" "club_responsibility";--> statement-breakpoint
ALTER TABLE "club_memberships" ADD COLUMN "status" "membership_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "club_responsibilities" ADD CONSTRAINT "club_responsibilities_membership_fk" FOREIGN KEY ("club_id","user_id") REFERENCES "public"."club_memberships"("club_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_responsibilities_user_idx" ON "club_responsibilities" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "club_responsibilities_one_owner_idx" ON "club_responsibilities" USING btree ("club_id") WHERE "club_responsibilities"."responsibility" = 'owner';--> statement-breakpoint
CREATE INDEX "club_memberships_club_status_idx" ON "club_memberships" USING btree ("club_id","status");--> statement-breakpoint
INSERT INTO "club_responsibilities" (
	"club_id",
	"user_id",
	"responsibility",
	"created_at",
	"updated_at"
)
SELECT
	"club_id",
	"user_id",
	CASE "role"
		WHEN 'owner' THEN 'owner'::"club_responsibility"
		WHEN 'admin' THEN 'admin'::"club_responsibility"
		WHEN 'coach' THEN 'coach'::"club_responsibility"
	END,
	"created_at",
	"updated_at"
FROM "club_memberships"
WHERE "role" IN ('owner', 'admin', 'coach');--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "club_invitations" WHERE "role" = 'owner') THEN
		RAISE EXCEPTION 'Cannot migrate an invitation with the unsupported owner role';
	END IF;
END
$$;--> statement-breakpoint
UPDATE "club_invitations"
SET "responsibility" = CASE "role"
	WHEN 'admin' THEN 'admin'::"club_responsibility"
	WHEN 'coach' THEN 'coach'::"club_responsibility"
	ELSE NULL
END;--> statement-breakpoint
ALTER TABLE "club_invitations" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "club_memberships" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "club_invitations" ADD CONSTRAINT "club_invitations_responsibility_check" CHECK ("club_invitations"."responsibility" is null or "club_invitations"."responsibility" in ('admin', 'coach'));--> statement-breakpoint
DROP TYPE "public"."club_role";
