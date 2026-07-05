# Squash Platform

Squash is a Costa Rica platform where Players build trusted squash relationships, organize social play, and compete, while Clubs manage membership, Club activities, and official competitions. The mobile app serves Players; the web portal serves Club and platform management.

## People and responsibilities

**Player**:
A registered person who participates in squash activities and competitions. A Player may belong to zero, one, or multiple Clubs.
_Avoid_: User, athlete

**Junior Player**:
A Player under eighteen whose account access, visibility, and social permissions are supervised by a verified Guardian. Players under thirteen have no independent login; Players aged thirteen through seventeen may use a restricted login and are discoverable only through a shared active Club or a direct Guardian- or Junior-shared profile link.
_Avoid_: Adult Player, dependent account

**Guardian**:
A single verified adult who gives consent for and supervises a Junior Player account, including control over visibility, social permissions, data access, and deletion. Guardianship may be transferred to another verified adult.
_Avoid_: Coach, Club Administrator

**Guardian Consent Record**:
The versioned record linking an authenticated, email-verified adult to a Junior Player, including the adult's declaration of legal authority, consent terms, and acceptance time.
_Avoid_: Identity-document verification, informal permission

**Junior Social Play Permission**:
A Guardian-controlled setting that enables a Junior Player's Friendships, Private and Group Play Sessions, Play Groups, Challenges, and Social Tournaments. Club-supervised activities remain available when it is disabled.
_Avoid_: Per-request approval, separate feature approvals

**Junior Club Participation Permission**:
A Guardian-controlled setting that lets a Junior Player manage Club Memberships and enter Official Tournaments without per-Club or per-event approval. Disabling it prevents future actions without ending existing Memberships or Tournament Participation.
_Avoid_: Per-Club approval, per-event approval, Junior Social Play Permission

**Equipment Profile**:
A Player-maintained informational record of their squash rackets, specifications, notes, and photos.
_Avoid_: Inventory, marketplace listing

**Player Profile**:
A Player's display name, avatar, biography, dominant hand, and Equipment Profile.
_Avoid_: Account, Competition Record

**Profile Visibility**:
A Player's choice to expose Player Profile details only to themselves, to Friends, or to Friends and active members of shared Clubs. Exact username discovery exposes only username, display name, and avatar for adult Players; Junior visibility is Guardian-controlled and excludes global search.
_Avoid_: Player Availability visibility

**Account Closure**:
The deletion of a Player's identifying, profile, availability, equipment, device, and direct social data while completed Club and competition history remains under a non-identifying reference.
_Avoid_: Cascading historical deletion, account suspension

**Moderation Report**:
A Player's or Guardian's request for Platform review of a Player, image, or event for safety or policy violations.
_Avoid_: Match result rejection, support request

**Platform Suspension**:
A Platform Administrator's reversible restriction preventing a Player from accessing the platform while preserving historical records.
_Avoid_: Club Membership suspension, Account Closure

**Platform Administrator**:
A person responsible for platform oversight, Club creation, and initial Club Owner assignment without routine access to private Player or Guardian data.
_Avoid_: Super admin, global admin

**Club Administrator**:
A Club Member responsible for managing one specific Club's Coaches and Players. The responsibility applies only within that Club and does not permit managing the Owner or other Club Administrators.
_Avoid_: Admin, manager

**Club Owner**:
The single Club Member with Club Administrator authority plus final responsibility for Administrator assignment, ownership transfer, and Club archival.
_Avoid_: Club Administrator, creator

**Coach**:
A Club Member who supports Players and coordinates Club Play Sessions within one specific Club.
_Avoid_: Trainer

**Club Responsibility**:
Additional authority held through a Club Membership, independently assignable as Club Owner, Club Administrator, or Coach. A member may hold multiple responsibilities in the same Club.
_Avoid_: Club role, Player role

## Clubs and membership

**Club**:
A squash organization that manages its own members, activities, and Official Tournaments.
_Avoid_: Organization, tenant

**Club Profile**:
A Club's discoverable identity and contact record, requiring a name, physical address, and at least one of contact email or contact phone. It may also include a logo, description, map link, and time zone.
_Avoid_: Club hours, court inventory, pricing

**Archived Club**:
A non-operating Club hidden from discovery and prevented from new activity while its Memberships and completed history remain preserved.
_Avoid_: Deleted Club, suspended Club

**Club Membership**:
The relationship connecting a Player to one Club, including zero or more Club Responsibilities. Responsibilities may coexist and do not apply to another Club.
_Avoid_: Account, access

**Membership Status**:
The lifecycle state of a Club Membership: Active, Suspended, or Ended. Suspension preserves the relationship while disabling access; an Ended membership requires a new request or invitation to rejoin.
_Avoid_: Club role, responsibility

**Membership Request**:
A Player's immutable submission asking to become a Club Member. Approval creates a Club Membership; cancellation or rejection requires a new submission for any later attempt.
_Avoid_: Application

**Club Invitation**:
A Club's invitation for an existing Player or an email recipient to become a Club Member. An email recipient becomes eligible to accept after registering as a Player with that email address.
_Avoid_: Membership request

## Player network

**Username**:
A unique shareable identifier used to find an eligible Player by exact search, profile link, or QR code without exposing their email address.
_Avoid_: Display name, email

**Friendship**:
A mutually accepted relationship between two Players that allows them to organize private activities together.
_Avoid_: Follow, connection

**Friend Request**:
One Player's pending request to establish a Friendship, which the recipient may accept or decline and the sender may cancel.
_Avoid_: Friendship, Club invitation

**Block**:
A one-sided restriction that ends a Friendship and prevents new direct social interactions without changing shared Club, Play Group, or Tournament relationships.
_Avoid_: Unfriend, suspension

**Play Group**:
A persistent, named group of Players who regularly organize Play Sessions together. It retains its identity without a scheduled session and is collectively owned by its members with equal authority.
_Avoid_: Club, session roster

**Play Group Membership**:
The equal relationship connecting a Player to a Play Group. It begins through an invitation issued through an existing Friendship but remains independent if that Friendship later changes.
_Avoid_: Friendship, Club Membership

## Play

**Player Availability**:
A Player's single recurring weekly schedule for finding mutually suitable Play Session times across Friends, Play Groups, and Clubs. It is visible only through an accepted Friendship, shared Play Group, or active shared Club and advises rather than restricts scheduling.
_Avoid_: Club availability, Club hours, court availability

**Availability Exception**:
A date-specific change that overrides a Player's recurring availability for that date.
_Avoid_: Recurring availability

**Play Session**:
A planned gathering where multiple Players meet to play squash. It may occur once or repeat on a schedule and may be hosted by a Player, Play Group, or Club; it does not itself imply a recorded Match.
_Avoid_: Match, meetup

**Play Session Host**:
The Player, Play Group, or Club responsible for a Play Session. Every Play Session has exactly one host.
_Avoid_: Owner, organizer

**Session Coordinator**:
The Player who creates and manages a Play Session on behalf of its host and may transfer coordination to a consenting eligible Player. Other participants may manage only their own Attendance Response.
_Avoid_: Session owner, host

**Club Play Session**:
A Play Session hosted by a Club and available only to its active Club Members.
_Avoid_: Open play, club event

**Private Play Session**:
A Play Session hosted by one Player and visible only to invited Friends of that Player.
_Avoid_: Public session, open play

**Group Play Session**:
A Play Session hosted by a Play Group and visible to every current member of that group.
_Avoid_: Private play session, group event

**Attendance Response**:
A Player's per-occurrence indication that they are going or not going to a Play Session. Having no response is distinct from declining.
_Avoid_: Group membership, tournament registration

**Play Session Series**:
A recurring schedule that defines how Play Session Occurrences repeat.
_Avoid_: Recurring match, recurring occurrence

**Play Session Occurrence**:
One dated instance in a Play Session Series, with its own attendance and lifecycle.
_Avoid_: Series, recurrence

**Match**:
A two-Player squash contest made up of one or more Games under defined scoring rules. Each Match is distinct even when Players meet through a recurring Play Session.
_Avoid_: Play session, game

**Game**:
One scoring unit within a Match, played to a configured point target and optionally requiring a two-point winning margin.
_Avoid_: Set

**Match Scoring Rules**:
The configuration shared by a Match: best-of one, three, or five Games; the target points per Game; and whether a two-point winning margin is required.
_Avoid_: Set rules, fixed standard scoring

**Proposed Result**:
A Challenge or Social Tournament Match score submitted by one participant and awaiting the other participant's confirmation. Rejection discards it so either participant may submit another proposal.
_Avoid_: Final result

**Confirmed Result**:
A Challenge or Social Tournament Match score accepted by both participants, eligible to affect Player statistics, and final without later dispute or correction.
_Avoid_: Proposed result, submitted score

**Competition Record**:
A Player's wins, losses, and played-Match statistics maintained separately for Challenges, Social Tournaments, and Official Tournaments. Aggregate records follow Profile Visibility, while authorized event viewers may see event-specific results.
_Avoid_: Unified ranking, Play Session statistics

**Challenge**:
A Player's invitation to an accepted Friend to accept one scheduled, scored Match proposal outside Club authority and outside a Tournament. Acceptance locks its date, venue, and Match Scoring Rules.
_Avoid_: Play session, tournament fixture

## Competitions

**Official Tournament**:
A competition owned and managed by one Club as an official Club event. Its participants may be registered Players from any Club or Players without a Club Membership.
_Avoid_: Club tournament

**Official Tournament Visibility**:
The discoverability mode selected as either Club-only, where only active Club Members may discover the Tournament, or Public, where every registered Player may discover it. In either mode, organizers may directly invite any registered Player.
_Avoid_: Player eligibility, Social Tournament visibility

**Official Result**:
A Tournament Match result recorded and finalized by a Tournament Organizer as the Club's authoritative result.
_Avoid_: Proposed result, participant-confirmed result

**Result Lock**:
The point after which a result cannot be corrected through normal organizer actions because downstream Tournament progression has begun.
_Avoid_: Result confirmation, Tournament completion

**Tournament Organizer**:
A Club Member granted management authority over one Official Tournament. Club Owners and Club Administrators have implicit authority; a Coach may be explicitly appointed.
_Avoid_: Club Administrator, tournament owner

**Group-to-Knockout Tournament**:
The supported singles competition format for at least three Players: Players first compete within round-robin groups, then qualifiers advance to a single-elimination bracket.
_Avoid_: League, double elimination, team tournament

**Tournament Seeding**:
The initial ordering of Players through either random assignment or manual organizer ordering.
_Avoid_: Ranking-based seeding

**Automatic Qualifier**:
A Player who advances by finishing in one of the configured qualifying positions within their Group.
_Avoid_: Wildcard qualifier

**Wildcard Qualifier**:
One of a configured number of best-performing Players at the next Group finishing position after the Automatic Qualifiers, compared across Groups using normalized Match, Game, and point win percentages.
_Avoid_: Automatic qualifier, organizer pick

**Knockout Draw**:
The automatically generated single-elimination bracket, arranged to avoid first-round rematches between Players from the same Group when possible.
_Avoid_: Draft Draw, manual bracket

**Knockout Seed**:
A qualifier's placement priority: Group winners first, then other Automatic Qualifiers by finishing position, then Wildcard Qualifiers, with normalized performance ordering each tier.
_Avoid_: Player ranking, manual seed

**Fixture Schedule**:
Optional informational date, time, venue text, and court label assigned to a Tournament Match without reserving a court.
_Avoid_: Court booking, court availability

**Organizer Tiebreak Decision**:
The final manual ordering of statistically inseparable Players by an authorized Official Tournament Organizer or the Social Tournament creator. No explanation is required, but the deciding person and time are recorded.
_Avoid_: Random draw, playoff

**Tournament Participation**:
An accepted relationship between a Player and a Tournament. Once accepted, it remains valid even if the Friendship or Club relationship used for initial eligibility later changes.
_Avoid_: Club Membership, Friendship

**Draft Draw**:
Preview group assignments generated before a Tournament starts. Roster changes invalidate the Draft Draw and require regeneration.
_Avoid_: Tournament start, final draw

**Tournament Start**:
The explicit action that finalizes the roster, draw, Match Scoring Rules, and, for an Official Tournament, visibility, then begins competition.
_Avoid_: Group generation, registration close

**Tournament Lifecycle**:
The shared progression through Draft, Registration Open, Group Stage, Knockout Stage, and either Completed or Cancelled.
_Avoid_: Registration closure as Tournament Start

**Tournament Withdrawal**:
A Player's departure after Tournament Start. Completed results remain valid and the Player cannot be replaced.
_Avoid_: Pre-start withdrawal, removal

**Walkover**:
A Match awarded to one Player without a recorded played result because the opponent withdrew, forfeited, or failed to respond. It advances Tournament progression but does not affect Competition Records.
_Avoid_: Bye, played result

**Social Tournament**:
An informal competition independently created and solely managed by one Player, visible only to that Player's accepted Friends. Its Match results become final through participant confirmation.
_Avoid_: Private tournament, player tournament
