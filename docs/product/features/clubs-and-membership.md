# Clubs and Membership

## Status

**Initial**

## Club creation and discovery

Only a Platform Administrator creates a Club and assigns its initial Club Owner.

Every active Club is discoverable by registered Players in mobile. Archived Clubs are hidden. Search results show the viewing Player's relationship: none, request pending, invited, Active, or Suspended.

When more than one relationship exists, search results use this precedence: Active or Suspended Membership, then Pending Membership Request, then Club Invitation, then none.

A Club Profile requires:

- name;
- physical address;
- at least one contact method: contact email or contact phone.

Both contact methods may be provided. A Club Profile may also contain:

- logo;
- description;
- map link;
- time zone.

Time zone is optional. Existing configured values are preserved, and the platform does not invent a default. Future recurring Club Play Sessions and time-based notifications must require a configured Club time zone before they are implemented.

New Club creation and every explicit Club Profile save enforce the required fields and contact-method rule. Existing Clubs may temporarily retain null migrated values until their Profile is saved.

Club Owners and Club Administrators may update the Club Profile through web management. Coaches and ordinary Players cannot update it.

Every registered Player may view an active Club's Player-facing Profile. Archived Clubs remain hidden from Player discovery and Player-facing Profile access. The Player-facing Profile does not expose management-only data.

Club hours, court inventory, pricing, booking, and payments are excluded.

## Club Membership

A Player may hold Memberships in multiple Clubs. Each Membership has one status:

- **Active** — normal access
- **Suspended** — access disabled while history and responsibilities remain
- **Ended** — relationship terminated; rejoining requires a new request or invitation

Club Responsibilities are independently assigned as Owner, Administrator, or Coach. Every member remains a Player. Exactly one active member is Club Owner.

## Membership Requests

Each submission is an immutable request:

- **Pending**
- **Approved**
- **Rejected**
- **Cancelled**

The Player may cancel only a Pending request. Club Owners and Club Administrators approve or reject Pending requests. Approval creates an Active Membership without additional responsibility. After rejection or cancellation, a later attempt creates a new request.

## Club Invitations

A Club may invite:

- an existing Player; or
- an email recipient who has not registered.

An unregistered recipient must register with the invited email before acceptance. Acceptance creates an Active Membership and closes the invitation.

The Club Owner may invite or assign an Administrator, Coach, or Player. A Club Administrator may invite or assign only Coach or Player responsibility.

## Membership management

- The Club Owner manages Administrators, Coaches, and Players.
- Club Administrators manage Coaches and Players.
- Administrators cannot manage the Owner or another Administrator.
- Suspended Memberships retain responsibilities but provide no Club access.
- Reactivation restores the preserved responsibilities.
- Removing a member ends the Membership and preserves history.
- A Player may voluntarily end their Membership.
- The Club Owner must transfer ownership before leaving, suspension, or removal.

Junior Membership actions require Junior Club Participation Permission, not per-Club Guardian approval.

## Club Play Sessions

Club Owners, Club Administrators, and Coaches may create and coordinate Club Play Sessions through web. Only active Club Members may discover and join them in mobile.

Club Play Sessions follow the shared recurrence and Attendance Response rules in [play and player network](play-and-player-network.md). They are scoreless in the Initial release and do not affect Competition Records.

## Club archival

A Club cannot be archived while an Official Tournament is in Group or Knockout Stage.

Archival:

- hides the Club from discovery;
- automatically transitions Pending Membership Requests to Cancelled, distinct from a
  Player cancellation or staff rejection;
- revokes pending Club Invitations;
- cancels future Club Play Sessions;
- cancels Draft and Registration Open Official Tournaments;
- prevents new Club activity;
- preserves Memberships and completed history.

The archival actor and reason are recorded through the archival audit record and the
existing resolution fields of affected records where applicable. The entire archival
cascade is atomic.

The Club Owner or a Platform Administrator may restore the Club. Restoration does not reopen cancelled Sessions, Tournaments, requests, or invitations.
