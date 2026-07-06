# Isolate credential-only management sessions

Better Auth 1.6.20 applies its built-in two-factor challenge to credential sign-in but not to
Google or Apple OAuth callbacks. Squash therefore uses separate Better Auth session boundaries:
Player authentication retains the existing session table and social providers, while web
management uses a credential-only Better Auth instance with its own session table, cookie prefix,
and API path.

Both instances share the canonical Player, credential account, verification, and Better Auth
two-factor records. Only the management instance installs the two-factor plugin. A Player/OAuth
session token is absent from the management-session table and remains invalid even if replayed
under the management cookie name. Management APIs accept only the isolated management session and
then evaluate current Platform authority or active Club Responsibilities.

Credential sessions created before TOTP enrollment are restricted to security onboarding.
Successful enrollment revokes those sessions, requiring a fresh credential sign-in whose session
is created only after Better Auth's TOTP, backup-code, or trusted-device verification succeeds.
Disabling MFA or resetting the shared Account password revokes every isolated management session
and trusted-device verification record so a prior device cannot regain assurance after
re-enrollment.

This duplicates a small amount of authentication configuration and adds a second session lifecycle,
but avoids custom assurance flags and makes OAuth isolation enforceable by the database-backed
session boundary.
