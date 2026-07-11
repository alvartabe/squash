# Competitions

## Status

- Official Tournaments: **Initial**
- Social Tournaments and Challenges: **Later**

## Shared Tournament format

Both Tournament types use singles Group-to-Knockout competition:

1. round-robin Group Stage;
2. Automatic and optional Wildcard qualification;
3. single-elimination Knockout Stage.

At least three accepted Players are required at Tournament Start. Doubles, teams, leagues, and other draw formats are excluded.

## Lifecycle

Both Tournament types use:

1. **Draft** — organizers only
2. **Registration Open** — discoverable to the eligible audience
3. **Group Stage** — Tournament Start locks competition inputs
4. **Knockout Stage** — qualifiers and bracket are locked
5. **Completed** or **Cancelled** — terminal

There is no separate Registration Closed state. Group generation before Start produces a Draft Draw only.

## Tournament configuration

Before Start, the authorized organizer configures:

- name, description, start information, and informational venue;
- Match Scoring Rules;
- random or manual Tournament Seeding;
- maximum Group size;
- Automatic Qualifier positions;
- optional Wildcard Qualifier count;
- Official Tournament Visibility when applicable.

Match Scoring Rules support:

- best-of one, three, or five Games;
- configurable target points per Game;
- optional win by two.

Tournament Start finalizes the roster, draw, scoring, and Official visibility. They cannot change afterward through ordinary management.

Ranking and ranking-based seeding are excluded.

## Registration and participation

### Official Tournament

Every Official Tournament belongs to exactly one Club. Club Membership is not required to participate.

Visibility is:

- **Club-only** — only active members of the owning Club discover it;
- **Public** — every registered Player discovers it.

In either mode, organizers may invite any registered Player. Players in the discoverable audience may request entry, subject to organizer approval. Organizers may add a registered Player directly. Visibility may change before Start without invalidating requests, invitations, or accepted participation.

### Social Tournament

The creator is the sole organizer. Only accepted Friends of the creator may discover, request entry, or receive an invitation.

Entry requires mutual approval:

- Friend requests; creator approves or rejects; or
- creator invites; Friend accepts or rejects.

Friendship is required at entry time only. Accepted Tournament Participation remains valid if the Friendship later changes.

### Juniors

Junior entry into Official Tournaments requires the standing Junior Club Participation Permission. Social Tournament entry requires Junior Social Play Permission.

## Draft Draw and roster lock

Organizers may generate and preview Groups during Registration Open. A roster change invalidates the Draft Draw and requires regeneration.

Tournament Start locks the roster. Before Start, Players may withdraw and organizers may remove them. After Start:

- no new Players or replacements;
- a departing Player is marked Withdrawn;
- completed results remain;
- unplayed Matches become Walkovers.

## Group assignment

The organizer chooses maximum Group size and Automatic Qualifier positions. The system balances Groups so sizes differ by at most one, every Group has at least two Players, and Automatic Qualifier count is less than the smallest Group.

Wildcard settings are separate from Automatic Qualifiers. Example: the top two from each Group plus the best two third-place Players.

## Group standings

Two Players tied on Match wins are separated by their head-to-head result.

For three or more tied Players, use only Matches among those tied Players:

1. Matches won
2. If reduced to two, head-to-head
3. Games won
4. If reduced to two, head-to-head
5. Game differential
6. If reduced to two, head-to-head
7. Point differential
8. If reduced to two, head-to-head

If Players remain statistically inseparable, the authorized Official Tournament Organizer or Social Tournament creator orders them manually. No written reason is required; the deciding person and time are audited.

## Wildcard comparison

Eligible Players at the next finishing position are compared across Groups by:

1. Match win percentage
2. Game win percentage
3. Point win percentage
4. Organizer Tiebreak Decision

Raw totals are not used because Group sizes may differ.

## Knockout Draw

The system generates the bracket automatically. Organizers cannot rearrange it after seeing qualifiers.

Seed priority is:

1. Group winners
2. Other Automatic Qualifiers by Group finishing position
3. Wildcard Qualifiers

Normalized Match, Game, and point win percentages order Players within each tier. Highest seeds receive required byes. The system avoids first-round rematches from the same Group when possible.

## Fixture scheduling

Organizers may optionally set date, time, venue text, and court label for a Match. These fields do not reserve courts or prevent conflicts.

Tournament Participation does not grant access to Player Availability.

## Results

### Official Results

Only an authorized Tournament Organizer records and finalizes an Official Result through web. Participants view results in mobile but do not submit or confirm them.

Before a scheduled Knockout Match starts, an authorized Tournament Organizer explicitly marks it as begun through web management. The Match becomes In Progress, its directly dependent prior-round Official Results become locked, and its initial Official Result may then be finalized. Group Matches do not require this explicit begin action.

An Organizer may correct:

- a Group result until Knockout Stage begins;
- a Knockout result until its dependent next-round Match begins.

Every ordinary correction requires a reason and audit record. After a Result Lock, Platform Administrator intervention is required.

### Social Tournament results

Either Match participant submits a Proposed Result in mobile. The opponent confirms or rejects it. Confirmation is immutable and advances the Tournament.

Results never auto-confirm. If a participant does not respond, the Social Tournament creator may send reminders and eventually award a Walkover, but cannot invent or edit a score.

### Walkovers

A Walkover advances the receiving Player but does not count as a played Match, win, or loss in a Competition Record.

## Cancellation

An authorized organizer may cancel before or after Start. Cancellation after Start requires a reason.

Completed Matches and statistics remain valid. Unplayed Matches are voided, and no champion is declared.

## Competition Records

Records remain separate for:

- Official Tournaments;
- Social Tournaments;
- Challenges.

Play Sessions and Walkovers never affect them. Aggregate records follow Profile Visibility; event-specific results remain visible to authorized event viewers.
