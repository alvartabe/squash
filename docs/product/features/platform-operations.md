# Platform Operations

## Status

**Initial**

## Notifications

Authenticated activity creates actionable in-app notifications.

The delivered mobile inbox shows the authenticated Player's Club Play Session invitation
notifications newest first. Each invitation is visibly read or unread. Opening an invitation
marks it read (without changing its original read time on a repeat) and opens that Club Play
Session when the Player remains authorized to view it. This delivered slice does not define
inbox behavior for other notification types.

Optional push notification categories are:

- Social
- Play Sessions
- Tournaments
- Clubs

Players may disable push by category. Security, consent, and account-recovery communications cannot be disabled.

Email is limited to:

- authentication and verification;
- security and account recovery;
- Club Invitations to unregistered recipients;
- Guardian consent and account events.

SMS is excluded.

## Localization

The product supports:

- Spanish (`es-419`), default for Costa Rica;
- English (`en-US`).

Each recipient's preference controls UI, push, in-app notification, and email language.

## Moderation

Players and Guardians may create a Moderation Report against:

- a Player;
- an image;
- a Club, Session, Group, or Tournament.

Platform Administrators review reports through web and may:

- dismiss the report;
- hide content;
- warn the responsible person;
- suspend or reactivate an account.

Blocking is immediately available to the reporting Player and does not wait for moderation.

## Platform Suspension

Suspension:

- immediately blocks login;
- hides the Player from discovery;
- prevents new activity;
- preserves Memberships, responsibilities, Groups, Tournaments, and history.

The Platform Administrator explicitly reassigns Club ownership, Session coordination, or Tournament authority where needed. Suspension does not silently cascade-delete relationships.

## Administrative privacy

Platform Administrator status does not grant routine access to:

- private Player Profiles;
- Player Availability;
- Guardian data.

Private access is allowed only for moderation, support, security, or legal handling and must be audited. Impersonation is prohibited.

## Audit

Audit records cover:

- Club creation, archival, restoration, and ownership transfer;
- Club Responsibility and Membership changes;
- Knockout Match begins and Official Result corrections;
- Organizer Tiebreak Decisions;
- Moderation and Platform Suspension;
- Guardian consent, permissions, and transfer;
- Account Closure;
- exceptional private-data access.

Routine navigation and Attendance Response changes are not audit events.

Platform Administrators have a read-only web audit index through an assured credential-only
management session. The server rechecks current Platform Administrator authority and returns audit
records newest first in pages of 50, using an opaque cursor with creation time and audit record ID
for deterministic ordering. Each row contains only the audit record ID, creation time, canonical
action code, optional actor ID, entity type, entity ID, and optional Club ID. Missing actor and Club
references remain valid historical evidence. The index does not expose raw audit metadata or join
Player, Player Profile, Guardian, or other private data, and it provides no record-detail or mutation
actions. Its loading, empty, error, and additional-page states are available in English and Latin
American Spanish; stored action codes and identifiers remain untranslated.

Retention durations require a documented policy approved by Costa Rican counsel before launch.

## MFA

MFA is mandatory before every web-management action by a Platform Administrator or a person with
an active Club Owner, Club Administrator, or Coach responsibility. Suspended and Ended Memberships
do not create management authority. Responsibilities in an archived Club do not create routine
management eligibility; the Club Owner remains eligible only for the documented restoration path.

Web management accepts only a credential-authenticated session completed with Better Auth TOTP,
single-use backup-code recovery, or a currently valid Better Auth trusted-device grant. Google and
Apple sessions remain valid for mobile Player actions but never satisfy the management
authentication boundary.

The server enforces this boundary before Platform or Club management authorization. An eligible
person without a credential receives `MANAGEMENT_CREDENTIAL_REQUIRED`; without completed
enrollment, `MFA_ENROLLMENT_REQUIRED`; and without a currently verified management session,
`MFA_VERIFICATION_REQUIRED`. UI navigation is not an authorization control.

Social-only Players who gain management authority may establish a password only through a fresh,
narrowly scoped security-onboarding session. They must then enroll TOTP and complete a new
credential-plus-TOTP sign-in. Enrollment sessions are never promoted into management-assured
sessions.

Trusted-device selection is optional and off by default. Better Auth's signed cookie and
verification record provide a rolling 30-day trust period. The interface warns against trusting
shared or public devices. Invalid, expired, revoked, or MFA-disabled trust cannot authorize
management. Disabling MFA or resetting the Account password revokes all management sessions and
trusted-device grants across every device.
