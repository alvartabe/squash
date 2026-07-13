# Current Code Gaps

Last reviewed: 2026-07-12.

This document identifies known differences between intended product behavior and the current repository. It is not an automatic backlog and does not authorize implementing Later features. Agents must verify each gap against current code before acting.

## Identity and safety

Adult Player Username maintenance and exact authenticated discovery are implemented through the
mobile Player Profile and a minimal Username lookup projection. Username values preserve display
casing and use the documented Unicode full-case-folded NFC comparison for lookup and database
uniqueness.
The lookup returns only Username, display name, and avatar, and excludes accounts marked as Junior;
the broader Guardian and Junior account lifecycle remains unimplemented. Username maintenance does
not introduce a separate Profile-setup lifecycle gate for other mobile journeys.

| Intended behavior                                     | Current evidence                                                                  | Gap                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Guardian-supervised Junior Players and age transition | Auth and profile tables in `packages/db/src/schema.ts`                            | No date of birth, Guardian, consent, Junior permissions, or transition |
| MFA required for web management                       | Isolated management auth sessions, Better Auth TOTP, and centralized route guards | Implemented; Google and Apple sessions remain Player-only              |
| Moderation Reports and Platform Suspension            | Schema and services                                                               | No report workflow or account suspension lifecycle                     |
| Anonymized Account Closure                            | Existing foreign-key deletion behavior                                            | No documented closure/anonymization service                            |

Club management authorization is capability-based at the service and web-workspace
boundaries. Platform Administrators have explicit Club view, restore, and Ownership
transfer recovery capabilities, but no implicit Membership, Tournament, Session,
Availability, or Result-management authority. Management eligibility excludes
responsibilities in archived Clubs except for the Owner's restore path.

## Play

One-time Club Play Sessions are implemented through `clubPlaySessions` and
`clubPlaySessionParticipants`. They use fixed Costa Rica scheduling, nullable
Going/Not going Attendance Responses, coordinator-only management, Active Membership
guards, optimistic versions, cancellation history, and no Match linkage. Recurrence,
Private Play Sessions, Group Play Sessions, Play Groups, and Player Availability remain
outside this delivered slice.

| Intended behavior                                                 | Current evidence                              | Gap                                                                                         |
| ----------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Session Series and independent Occurrences                        | One-time Club Play Session schema             | No recurrence series/occurrence model                                                       |
| Coordinator transfer to a consenting eligible Player              | Coordinator is fixed at Session creation      | No documented consent workflow or transfer implementation                                   |
| Availability is global, relationship-visible, advisory, and Later | `recurringAvailability` has optional `clubId` | Current model permits Club-specific windows and lacks agreed visibility/suggestion behavior |
| Persistent, equally owned Play Groups are Later                   | No corresponding model                        | Not implemented                                                                             |

## Challenges and social results

| Intended behavior                                      | Current evidence                                         | Gap                                                 |
| ------------------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------- |
| Challenges are Club-independent                        | `createChallenge` accepts optional `clubId`              | Current model may associate a Challenge with a Club |
| Opponent confirmation makes a result final             | `submitMatchResult` in `packages/server/src/services.ts` | Initial submission completes the Match immediately  |
| Rejection discards a Proposed Result; no dispute state | `challengeStatus`, dispute route, and `disputeChallenge` | Current code supports post-completion dispute       |
| Confirmed social results are immutable                 | Result revision and administrative correction logic      | Current code supports later revisions               |
| Game terminology                                       | `SetScore`, `matchSets`, and scoring functions           | Code uses “set” rather than canonical “Game”        |

Challenges remain Later despite partial implementation.

## Tournaments

Official Tournament discovery, explicit Club-only or Public visibility, the Draft to
Registration Open transition, Entry Requests, Invitations, direct addition, accepted
Tournament Participation, pre-Start withdrawal and removal, and Draft Draw invalidation
are implemented. Tournament Start finalizes the accepted roster and Draft Draw by
creating Group Stage fixtures and moving the Tournament to Group Stage. Authorized web
managers can view finalized Group Stage fixtures with Match status and Player identity
details. Participation is independent of Club Membership, and management routes use the
isolated management-authentication boundary.

The mobile Player Tournament list retains authorized Official Tournaments from Registration
Open through Completed or Cancelled. A Player-authenticated detail endpoint and mobile screen
expose Player-relevant identity, description, informational venue, lifecycle, locked configuration,
finalized Groups, canonical
current standings, Group fixtures, finalized Official Results with Game scores, the Knockout
Draw, persisted Fixture Schedule details, and the champion only for a Completed Tournament. Public
access is available to every registered Player; Club-only detail access requires an Active
Membership in the owning Club or accepted Tournament Participation. Pending Entry Requests and
Invitations do not extend Club-only visibility after the qualifying Membership changes. Accepted
Tournament Participation continues to grant event access after the Membership that originally
established eligibility changes. Public and accepted-participant completed history remains in the
mobile list after Club archival. The
Player projection does not expose Draft Draws, organizer audit data, correction reasons,
revisions, Result Locks, or any result-management action. English and Latin American Spanish
mobile copy cover the delivered experience.

Tournament creation persists description and informational venue. Match persistence and the shared
fixture read model carry optional schedule date/time, venue text, and court label so the Player
projection displays those values in the Tournament time zone. Authorized web Organizers may set or
clear the Fixture Schedule while its Match remains Scheduled; the mutation rechecks Tournament
authority in the transaction and stops accepting changes after the Match begins.

The Organizer Tiebreak Decision workflow is implemented for statistically inseparable
Group standings, Wildcard qualification cutoffs, and Knockout seeding. The management
read model exposes the current tied Players and context; an authorized Tournament
Organizer can order exactly those Players in English or Spanish web management. The
immutable decision records its Tournament context, selected order, deciding organizer,
and timestamp, rejects stale or invalid submissions, and resumes progression without an
ID-based fallback.

Organizer-controlled Official Results are implemented through the isolated web-management
authentication boundary for Group and available Knockout fixtures. Authorized Tournament
Organizers finalize the initial result against the Match Scoring Rules snapshot; the Match,
Game scores, immutable result revision, audit record, statistics rebuild event, and deterministic
Tournament progression event are written atomically. Participants can view Official Results but
the Player-authenticated result route rejects Tournament Matches.

Ordinary Official Result corrections and dependency-based Result Locks are implemented in the
same Official Result module. Corrections require an expected current revision and non-empty reason,
lock and recheck current Tournament Organizer authority in a serializable transaction, replace the
Match and Game result, synchronously rebuild affected Official Tournament statistics, update an
unstarted dependent Knockout fixture when its advancing winner changes, append immutable revision
and audit evidence, and enqueue revision-addressed statistics and progression events atomically.
Group results lock when Knockout Stage begins; Knockout results lock when their dependent next-round
Match begins. An authorized Organizer explicitly begins each scheduled Knockout Match through web
management, moving it to In Progress before its initial Official Result can be finalized and making
the dependency lock enforceable. Web management exposes begin, correction, and lock states in
English and Spanish. Group-to-Knockout progression locks the Tournament and rechecks the complete
Group-result revision snapshot before creating the bracket, so stale qualification calculations
cannot advance. Official Result request parsing returns the same stable invalid-Game error used by
domain score validation.

Tournament management mutations lock the Tournament and re-evaluate the Organizer's
current Club responsibility or explicit Coach appointment in the same transaction as
the write, so revoked authority cannot be reused from an earlier check.

The legacy direct-registration table was pre-release/dev-only and intentionally removed
without migration because it had no production participation data to preserve. The new
Entry Request, Invitation, and accepted Tournament Participation model is the first
supported Official Tournament registration model.

The Junior Club Participation Permission cannot yet be enforced for Tournament entry
because the repository has no Guardian, Junior age, consent, or permission model. This
slice does not invent a bypass, denial rule, or consent mechanism.

| Intended behavior                                | Current evidence                 | Gap                                                                                   |
| ------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------- |
| Official and Social Tournament ownership models  | `tournaments.clubId` is required | Current schema supports Official Club ownership only; Social Tournaments remain Later |
| Separate Official and Social Competition Records | `tournamentStats`                | All Tournament statistics share one category                                          |

Social Tournaments remain Later.

## Applications

| Intended behavior                                | Current evidence                                                                                       | Gap                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Mobile contains complete Player journeys         | Club Sessions, Club Membership, and pre-Start Official Tournament participation are functional         | Several other Initial Player journeys remain incomplete                          |
| Web contains only management capabilities        | Club Session, Membership, and pre-Start Official Tournament management are functional workspace routes | Other management features remain placeholders                                    |
| Spanish default for Costa Rica, English optional | `packages/i18n`                                                                                        | Both languages exist; default and complete feature coverage require verification |
| Product terminology and Initial scope            | Match and Later-feature code                                                                           | Some dormant legacy Match terminology still uses sets                            |

## Operational gaps

The mobile in-app notification inbox is implemented for Club Play Session invitations. Its
typed Player-facing projection excludes raw notification rows and other notification types;
it lists the authenticated Player's invitations newest first, preserves in-app availability
regardless of optional push preferences, marks invitations read idempotently, and opens the
authorized one-time Club Play Session destination. Other notification types have no inbox
behavior in this delivered slice.

- Audit coverage does not yet include every documented sensitive action.
- Platform private-data access is not implemented as an audited least-privilege workflow.
- Data retention periods remain intentionally unresolved pending Costa Rican legal review.
