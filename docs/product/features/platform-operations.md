# Platform Operations

## Status

**Initial**

## Notifications

Authenticated activity creates actionable in-app notifications.

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
- Official Result corrections;
- Organizer Tiebreak Decisions;
- Moderation and Platform Suspension;
- Guardian consent, permissions, and transfer;
- Account Closure;
- exceptional private-data access.

Routine navigation and Attendance Response changes are not audit events.

Retention durations require a documented policy approved by Costa Rican counsel before launch.

## MFA

MFA is mandatory before any web management action by a Platform Administrator, Club Owner, Club Administrator, or Coach. Mobile Player access may use optional MFA.
