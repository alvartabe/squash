# Current Code Gaps

Last reviewed: 2026-07-05.

This document identifies known differences between intended product behavior and the current repository. It is not an automatic backlog and does not authorize implementing Later features. Agents must verify each gap against current code before acting.

## Identity and safety

| Intended behavior                                     | Current evidence                                                                  | Gap                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Unique Username and relationship-based discovery      | `users` and `playerProfiles` in `packages/db/src/schema.ts`                       | No Username or discovery model                                         |
| Guardian-supervised Junior Players and age transition | Auth and profile tables in `packages/db/src/schema.ts`                            | No date of birth, Guardian, consent, Junior permissions, or transition |
| MFA required for web management                       | Isolated management auth sessions, Better Auth TOTP, and centralized route guards | Implemented; Google and Apple sessions remain Player-only              |
| Moderation Reports and Platform Suspension            | Schema and services                                                               | No report workflow or account suspension lifecycle                     |
| Anonymized Account Closure                            | Existing foreign-key deletion behavior                                            | No documented closure/anonymization service                            |

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

The legacy direct-registration table was pre-release/dev-only and intentionally removed
without migration because it had no production participation data to preserve. The new
Entry Request, Invitation, and accepted Tournament Participation model is the first
supported Official Tournament registration model.

The Junior Club Participation Permission cannot yet be enforced for Tournament entry
because the repository has no Guardian, Junior age, consent, or permission model. This
slice does not invent a bypass, denial rule, or consent mechanism.

| Intended behavior                                | Current evidence                   | Gap                                                                                   |
| ------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------- |
| Official and Social Tournament ownership models  | `tournaments.clubId` is required   | Current schema supports Official Club ownership only; Social Tournaments remain Later |
| Automatic plus Wildcard qualifiers               | `qualifiersPerGroup`               | Fixed qualifiers per Group only                                                       |
| Fixed Squash Canada-style tiebreak procedure     | `packages/domain/src/standings.ts` | Current ordering uses a simpler whole-Group comparison and internal ID fallback       |
| Normalized Wildcard comparison                   | Tournament domain                  | Not implemented                                                                       |
| Automatic tiered Knockout Draw                   | `packages/domain/src/bracket.ts`   | Existing ordering compares raw wins/differentials and does not model Wildcards        |
| Organizer-controlled Official Results            | `submitMatchResult`                | Participants currently submit initial Tournament results                              |
| Dependency-based Result Locks                    | Revision logic                     | Current corrections do not model agreed phase/dependency locks                        |
| Separate Official and Social Competition Records | `tournamentStats`                  | All Tournament statistics share one category                                          |

Social Tournaments remain Later.

## Applications

| Intended behavior                                | Current evidence                                                                                       | Gap                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Mobile contains complete Player journeys         | Club Sessions, Club Membership, and pre-Start Official Tournament participation are functional         | Several other Initial Player journeys remain incomplete                          |
| Web contains only management capabilities        | Club Session, Membership, and pre-Start Official Tournament management are functional workspace routes | Other management features remain placeholders                                    |
| Spanish default for Costa Rica, English optional | `packages/i18n`                                                                                        | Both languages exist; default and complete feature coverage require verification |
| Product terminology and Initial scope            | Match and Later-feature code                                                                           | Some dormant legacy Match terminology still uses sets                            |

## Operational gaps

- Notification preferences and mandatory communication categories are not fully represented.
- Audit coverage does not yet include every documented sensitive action.
- Platform private-data access is not implemented as an audited least-privilege workflow.
- Data retention periods remain intentionally unresolved pending Costa Rican legal review.
