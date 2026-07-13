ALTER TABLE "users" ADD COLUMN "platform_suspended_at" timestamp with time zone;--> statement-breakpoint
CREATE FUNCTION "enforce_platform_account_session_access"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_suspension timestamp with time zone;
BEGIN
  SELECT "platform_suspended_at"
    INTO current_suspension
    FROM "users"
    WHERE "id" = NEW."user_id"
    FOR SHARE;
  IF current_suspension IS NOT NULL THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "sessions_platform_account_access"
BEFORE INSERT ON "sessions"
FOR EACH ROW
EXECUTE FUNCTION "enforce_platform_account_session_access"();--> statement-breakpoint
CREATE TRIGGER "management_sessions_platform_account_access"
BEFORE INSERT ON "management_sessions"
FOR EACH ROW
EXECUTE FUNCTION "enforce_platform_account_session_access"();
