# Play and Player Network

## Status

- One-time Club Play Sessions: **Initial**
- Club Play Session recurrence: **Initial, later delivery slice**
- Friendships, Availability, Play Groups, Private and Group Play Sessions, and Challenges: **Later**

## Friendships

Adult Players may be found by exact Username, profile link or QR code, or shared Club roster. Junior discovery follows the restrictions in [accounts and safety](accounts-and-safety.md).

A Friend Request is Pending until:

- the sender cancels;
- the recipient accepts; or
- the recipient declines.

Acceptance creates a mutual Friendship. Either Friend may end it. A new request is allowed after decline or removal.

Blocking:

- ends the Friendship;
- prevents new Friend Requests and direct social invitations;
- does not alter shared Club Memberships, Play Group Memberships, or accepted Tournament Participation.

Unblocking removes only the restriction; it does not restore prior relationships or invitations.

Junior Friendships require Junior Social Play Permission. That setting is standing Guardian approval, not per-request approval, and permits adult-to-Junior Friendships.

## Player Availability

Each Player maintains one global recurring weekly schedule plus date-specific Availability Exceptions.

Availability is visible only through:

- an accepted Friendship;
- a shared Play Group; or
- an active shared Club.

Tournament Participation alone never exposes Availability.

Availability is advisory. Scheduling may suggest overlapping windows, but it never prevents a Session, Match, RSVP, or Tournament fixture outside those windows.

## Play Session types

Every Play Session has exactly one host:

- **Player** — Private Play Session, visible only to invited Friends
- **Play Group** — Group Play Session, visible to all current Group Members
- **Club** — Club Play Session, visible only to active Club Members

Initial Club Play Sessions are scoreless. Recording Matches inside Play Sessions is not defined for a later phase and requires a future product decision; it must never be inferred from attendance alone.

The Session Coordinator creates, edits, and cancels the Session. Participants manage only their own Attendance Responses.

The current Initial-release slice supports one-time Club Play Sessions only. Scheduling
is entered and presented in `America/Costa_Rica`; timestamps are persisted as absolute
instants. This slice does not read or configure a Club Profile time zone.

A one-time Club Play Session is Scheduled or Cancelled. Creation requires a future start
and an end after the start. Only its active Session Coordinator may edit, cancel, or
invite participants, and only before the scheduled start. Cancellation preserves the
Session, participants, and Attendance Responses as history. A Cancelled or started
Session cannot be edited, cancelled again, receive invitations, or accept Attendance
Response changes.

For a Club Play Session, the Coordinator may invite any Active Club Member before the
start. An invitation records participation with **No response**; it is not an Attendance
Response. Invitation does not prevent other Active Club Members from discovering the
Session and responding. Participant removal is not part of this slice.

Changing a one-time Session's start or end clears every other participant's prior
Attendance Response to No response. The Session Coordinator remains Going.

## Attendance Responses

For each occurrence:

- **No response** is implicit.
- **Going** means expected to attend.
- **Not going** means explicitly declined.

The Session Coordinator starts as Going. An Active Club Member may set or change only
their own response before the occurrence starts, whether or not they were invited. A
Suspended or Ended Club Member cannot view the Session or change a response, but prior
participation remains in history. There is no Maybe state, capacity, waitlist, participant
removal, or court reservation.

## Recurrence

A Play Session Series defines recurrence. Each Play Session Occurrence has independent date, attendance, changes, and cancellation.

Recurrence is not implemented in the one-time Club Play Session delivery slice.

Editing or cancelling supports:

- this occurrence only;
- this and future occurrences.

Past occurrences never change. Future Attendance Responses are cleared only when a date or time changes materially.

## Play Groups

A Play Group is persistent and collectively owned by equal Members.

- Any Member may edit the Group name or image.
- Any Member may invite one of their accepted Friends.
- The invitee must accept.
- Friendship is required only when the invitation is issued.
- Membership remains if the originating Friendship later changes.
- Members may leave but cannot remove another Member or delete the Group unilaterally.
- The Group ends when its final Member leaves.
- Any Member may create a Group Play Session.
- Only that Session's Coordinator may edit or cancel it.

Before leaving, a Coordinator must transfer future Group Sessions or Series to a consenting Member or cancel them.

## Private Play Sessions

A Player may create a one-time or recurring Session without a Play Group. Only the host's accepted Friends may be invited, and only invitees may see or join it.

## Challenges

A Challenge is Club-independent and always between accepted Friends.

The creator proposes:

- date and time;
- informational venue;
- best-of one, three, or five Games;
- target points per Game;
- whether a two-point winning margin is required.

The invited Player accepts or rejects the complete proposal. Acceptance locks it; changes require cancellation and a new Challenge.

Before acceptance, the creator may withdraw. After acceptance and before a Confirmed Result, either participant may cancel. Cancellation never affects Competition Records.

Either participant submits a Proposed Result. The other participant:

- confirms it, making it immutable and eligible for Challenge statistics; or
- rejects it, discarding the proposal and returning the Match to Awaiting Result.

There is no dispute state, post-confirmation correction, Club arbitration, or Platform arbitration.
