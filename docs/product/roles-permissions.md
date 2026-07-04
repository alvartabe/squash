# Roles and Permissions

## Identity model

Every registered person is a Player. Club Owner, Club Administrator, and Coach are composable Club Responsibilities attached to a Club Membership; they are not mutually exclusive identities.

A Player may hold different responsibility combinations in different Clubs. Exactly one active member holds Club Owner responsibility in each active Club.

## Product surfaces

| Person or responsibility | Mobile                   | Web                        |
| ------------------------ | ------------------------ | -------------------------- |
| Player                   | Player capabilities      | No Player portal           |
| Guardian                 | Junior supervision       | No management portal       |
| Coach                    | Player capabilities only | Authorized Club management |
| Club Administrator       | Player capabilities only | Authorized Club management |
| Club Owner               | Player capabilities only | Authorized Club management |
| Platform Administrator   | Player capabilities only | Platform oversight         |

Mobile never switches into management mode.

## Club authority

| Capability                                  | Owner | Administrator |        Coach | Player |
| ------------------------------------------- | ----: | ------------: | -----------: | -----: |
| View active shared Club                     |   Yes |           Yes |          Yes |    Yes |
| Update Club Profile                         |   Yes |           Yes |           No |     No |
| Archive or restore Club                     |   Yes |            No |           No |     No |
| Review Membership Requests                  |   Yes |           Yes |           No |     No |
| Invite Coaches or Players                   |   Yes |           Yes |           No |     No |
| Grant or revoke Administrator               |   Yes |            No |           No |     No |
| Manage another Administrator                |   Yes |            No |           No |     No |
| Manage Coaches and Players                  |   Yes |           Yes |           No |     No |
| Transfer Club ownership                     |   Yes |            No |           No |     No |
| Create and coordinate Club Play Sessions    |   Yes |           Yes |          Yes |     No |
| Create Official Tournaments                 |   Yes |           Yes |           No |     No |
| Manage every Official Tournament in Club    |   Yes |           Yes |           No |     No |
| Manage an appointed Official Tournament     |   Yes |           Yes | If appointed |     No |
| Record or correct unlocked Official Results |   Yes |           Yes | If appointed |     No |

A person with multiple responsibilities receives the union of their permissions. Club Responsibilities never grant authority in another Club.

## Membership hierarchy

- Only the Club Owner manages the Owner responsibility.
- Only the Club Owner grants, revokes, suspends, reactivates, removes, or changes a Club Administrator.
- Club Owners and Club Administrators manage Coaches and Players.
- A Club Owner must transfer ownership before leaving, suspension, or removal.
- Platform Administrators may perform explicit recovery and oversight actions but do not receive routine access to private Player or Guardian data.

## Tournament authority

- Club Owners and Club Administrators have implicit authority over all Official Tournaments owned by their Club.
- A Coach has authority only after appointment as Tournament Organizer for that Tournament.
- The Social Tournament creator is its sole organizer.
- Challenge participants control their own proposals and confirmations.

## Session authority

- The Session Coordinator alone edits or cancels a Play Session or Series.
- Any Play Group Member may create a Group Play Session.
- Leaving a Play Group requires transferring or cancelling future coordinated Sessions.
- Participants manage only their own Attendance Responses.

## Guardian authority

The single Guardian controls:

- consent and Junior account creation;
- restricted login access;
- Junior Profile Visibility;
- Junior Social Play Permission;
- Junior Club Participation Permission;
- access to and deletion of Junior data;
- Guardian transfer.

Under-thirteen Junior Players have no independent login. Junior settings cease automatically at eighteen.

## Platform authority

Platform Administrators may:

- create Clubs and assign initial Club Owners;
- restore or recover Club administration;
- review Moderation Reports;
- hide content, warn, suspend, or reactivate accounts;
- perform dependency-locked Official Result intervention;
- access private data only for support, moderation, security, or legal work with an audit record.

Platform Administrators cannot impersonate another person.
