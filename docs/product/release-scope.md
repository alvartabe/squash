# Release Scope

The complete product vision is larger than one implementation milestone. This document determines what agents may treat as Initial scope.

## Initial release

The Initial release proves the governed Club workflow:

- Adult and Junior Player accounts
- Guardian consent, supervision, and age transition
- Player identity, Profile Visibility, and Account Closure
- Club discovery and Club Profiles
- Membership Requests, Club Invitations, Membership lifecycle, and composable Club Responsibilities
- Web management for Platform Administrators, Club Owners, Club Administrators, and Coaches
- Club Play Sessions, recurrence, and Attendance Responses
- Official Tournaments using the Group-to-Knockout format
- Official Tournament registration, invitations, visibility, draws, standings, results, and Competition Records
- In-app, push, and required email notifications
- Moderation Reports, Platform Suspension, blocking, and audit records
- Spanish and English
- Mandatory MFA for web management

## Later

These capabilities are accepted parts of the product but are not Initial scope:

- Friendships and direct Player discovery beyond Initial Club needs
- Player Availability and Availability Exceptions
- Equipment Profiles
- Play Groups
- Private and Group Play Sessions
- Challenges
- Social Tournaments
- Challenge and Social Tournament Competition Records

Later features remain documented so their boundaries are known. They must not be implemented incidentally while building Initial features.

## Excluded

Excluded capabilities are listed in [non-goals.md](non-goals.md).

## Initial end-to-end journeys

### Player joins a Club

1. The Player discovers an active Club in mobile.
2. The Player submits a Membership Request or accepts a Club Invitation.
3. Club staff reviews the request when applicable.
4. Approval creates an Active Club Membership.
5. The Player can view Club Play Sessions and Club-only Official Tournaments.

### Club staff manages membership

1. A Club Owner or Club Administrator reviews pending requests.
2. They approve or reject each request.
3. They assign Coach or Player responsibilities as authorized.
4. Only the Club Owner grants or revokes Club Administrator responsibility.
5. Memberships may be suspended, reactivated, or ended without deleting history.

### Club runs an Official Tournament

1. Authorized staff creates a Draft and configures visibility, scoring, advancement, and seeding.
2. The Tournament is opened for registration.
3. Players request entry or receive invitations.
4. Organizers manage the roster and preview Draft Draws.
5. Tournament Start locks the roster, draw, scoring, and visibility.
6. Organizers record Official Results through Group and Knockout Stages.
7. The completed Tournament contributes to Official Tournament Competition Records.

### Guardian supervises a Junior

1. An authenticated adult verifies email, declares legal authority, and accepts versioned consent.
2. The Guardian creates or approves the Junior Player.
3. Age determines whether the Junior has no login or restricted login.
4. Guardian settings control social play, Club participation, Profile Visibility, data access, and closure.
5. The account becomes independent automatically at eighteen.
