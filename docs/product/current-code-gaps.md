# Current Code Gaps

Last reviewed: 2026-07-05.

This document identifies known differences between intended product behavior and the current repository. It is not an automatic backlog and does not authorize implementing Later features. Agents must verify each gap against current code before acting.

## Identity and safety

| Intended behavior                                     | Current evidence                                            | Gap                                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| Unique Username and relationship-based discovery      | `users` and `playerProfiles` in `packages/db/src/schema.ts` | No Username or discovery model                                         |
| Guardian-supervised Junior Players and age transition | Auth and profile tables in `packages/db/src/schema.ts`      | No date of birth, Guardian, consent, Junior permissions, or transition |
| MFA required for web management                       | Auth configuration in `packages/server/src/auth.ts`         | No documented role-gated MFA enforcement                               |
| Moderation Reports and Platform Suspension            | Schema and services                                         | No report workflow or account suspension lifecycle                     |
| Anonymized Account Closure                            | Existing foreign-key deletion behavior                      | No documented closure/anonymization service                            |

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

| Intended behavior                                | Current evidence                   | Gap                                                                             |
| ------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------- |
| Official and Social Tournament ownership models  | `tournaments.clubId` is required   | Current schema supports Official Club ownership only                            |
| Cross-Club and clubless Official participation   | `registerForTournament`            | Current service requires active Membership in the owning Club                   |
| Club-only or Public Official visibility          | Tournament schema                  | No visibility mode                                                              |
| Draft Draw is separate from Tournament Start     | `generateTournamentGroups`         | Group generation immediately moves to Group Stage                               |
| Automatic plus Wildcard qualifiers               | `qualifiersPerGroup`               | Fixed qualifiers per Group only                                                 |
| Fixed Squash Canada-style tiebreak procedure     | `packages/domain/src/standings.ts` | Current ordering uses a simpler whole-Group comparison and internal ID fallback |
| Normalized Wildcard comparison                   | Tournament domain                  | Not implemented                                                                 |
| Automatic tiered Knockout Draw                   | `packages/domain/src/bracket.ts`   | Existing ordering compares raw wins/differentials and does not model Wildcards  |
| Random or Manual seeding only                    | `seedingMethod` includes `ranking` | Ranking seeding exists without a ranking product                                |
| Best-of 1, 3, or 5 Games                         | `BestOf` includes 7                | Best-of-7 exceeds intended rules                                                |
| Organizer-controlled Official Results            | `submitMatchResult`                | Participants currently submit initial Tournament results                        |
| Dependency-based Result Locks                    | Revision logic                     | Current corrections do not model agreed phase/dependency locks                  |
| Separate Official and Social Competition Records | `tournamentStats`                  | All Tournament statistics share one category                                    |

Social Tournaments remain Later.

## Applications

| Intended behavior                                | Current evidence                                                                  | Gap                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Mobile contains complete Player journeys         | Club Sessions and Club Membership are functional; Tournaments remain placeholders | Several Initial Player journeys remain incomplete                                |
| Web contains only management capabilities        | Club Session and Membership management are functional workspace routes            | Other management features remain placeholders                                    |
| Spanish default for Costa Rica, English optional | `packages/i18n`                                                                   | Both languages exist; default and complete feature coverage require verification |
| Product terminology and Initial scope            | Match and Later-feature code                                                      | Some dormant legacy Match terminology still uses sets                            |

## Operational gaps

- Notification preferences and mandatory communication categories are not fully represented.
- Audit coverage does not yet include every documented sensitive action.
- Platform private-data access is not implemented as an audited least-privilege workflow.
- Data retention periods remain intentionally unresolved pending Costa Rican legal review.
