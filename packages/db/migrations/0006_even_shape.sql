ALTER TYPE "public"."media_purpose" ADD VALUE 'club-logo';--> statement-breakpoint
ALTER TABLE "clubs" ALTER COLUMN "time_zone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "logo_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "physical_address" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "map_link" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_logo_asset_id_media_assets_id_fk" FOREIGN KEY ("logo_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;