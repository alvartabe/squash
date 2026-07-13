# Accounts and Safety

## Status

- Core accounts, Junior supervision, moderation, and closure: **Initial**
- Equipment Profile: **Later**

## Adult Players

An adult creates an independent account, verifies their email, and maintains one unique Username
as part of their Player Profile. The mobile Profile experience lets the Player view and update the
Username. The absence of a Username does not create a separate account lifecycle state or block
access to other mobile journeys.

### Accepted Username policy

The following rules are accepted product behavior, not implementation defaults:

- A Username contains 3–30 Unicode letters or numbers, underscores, or periods, with no spaces.
- It is stored in Unicode NFC form and preserves the Player's chosen letter casing for display.
- Uniqueness and exact discovery compare Unicode full-case-folded values followed by NFC
  normalization.
- Exact Username search exposes only Username, display name, and avatar.

Changing the Username format, normalization, or comparison rules requires a new product decision
and a corresponding update to this document.

Profile Visibility has three levels:

- **Private** — only the Player
- **Friends** — accepted Friends
- **Community** — Friends and active members of shared Clubs

Bio, dominant hand, avatar detail, and Equipment Profile follow Profile Visibility. Aggregate Competition Records follow Profile Visibility; authorized event viewers may still see event-specific participants and results.

## Junior Players

Costa Rica-based Players under eighteen are Junior Players.

- Under thirteen: no independent login; the Guardian operates the profile.
- Ages thirteen through seventeen: restricted login linked to one Guardian.
- At eighteen: automatic conversion to an independent adult Player account; Guardian access ends and existing relationships and records remain.

Junior Profiles:

- default to Private;
- can have visibility changed only by the Guardian;
- never appear in global Username search;
- may be discovered through an active shared Club or a direct profile link or QR code shared by the Junior or Guardian.

## Guardian verification and consent

The Guardian:

1. creates an authenticated adult account;
2. verifies email;
3. provides date of birth;
4. declares legal authority over the Junior;
5. accepts a versioned digital consent record.

Identity-document images are not collected in the Initial release. One Guardian supervises each Junior; Guardianship may be transferred to another verified adult.

Consent records include the Guardian, Junior, accepted terms version, and acceptance time. Withdrawal of consent immediately disables Junior access and visibility and starts Account Closure.

## Guardian permissions

Both Guardian permissions are disabled until the Guardian explicitly enables them.

**Junior Social Play Permission** governs:

- Friendships
- Private and Group Play Sessions
- Play Groups
- Challenges
- Social Tournaments

Disabling it prevents new direct social actions without deleting existing Friendship records.

**Junior Club Participation Permission** governs:

- Membership Requests
- Club Invitation acceptance
- voluntary Club departure
- Official Tournament requests, invitations, and participation

Disabling it prevents future actions without ending existing Memberships or Tournament Participation.

## Equipment Profile

Later, Players may maintain informational racket records containing brand, model, weight, balance, string information, notes, and photos.

Equipment is not an inventory, marketplace, recommendation, or commerce feature.

## Account security

- Web management requires credential authentication plus TOTP for Platform Administrators and
  active Club Owners, Club Administrators, and Coaches. A signed-in session is authorized for
  management only when it was created through the credential-only management authentication
  boundary after TOTP or valid trusted-device verification.
- A responsibility in an archived Club does not create routine web-management eligibility. The
  Club Owner remains eligible only so the documented restoration path can be completed; archived
  Club Administrator and Coach responsibilities do not provide management authority.
- Google and Apple authentication remain available for mobile Player access. A session created by
  either provider is a Player session and cannot authorize web-management operations, including
  when the Player has enabled MFA.
- A social-only Player who gains a management responsibility must use a fresh authenticated
  security-onboarding flow to establish a credential account, then sign in with that credential to
  enroll TOTP. Completing enrollment invalidates the enrollment session; management requires a new
  email/password and TOTP sign-in.
- Enrollment uses an authenticator application and does not enable MFA until a valid TOTP code is
  verified. Generated single-use backup codes are shown once for recovery. Regenerating codes
  invalidates every previously generated backup code.
- After successful TOTP or backup-code verification, the person may choose “Trust this device for
  30 days.” It is off by default and warns against shared or public devices. Better Auth's signed
  trusted-device cookie uses a rolling 30-day period; invalid, expired, or revoked trust does not
  authorize management.
- Disabling MFA or gaining management authority without completed enrollment immediately blocks
  management. Disabling MFA and resetting the Account password revoke every management session
  and trusted-device grant for that Player. Re-enrollment cannot restore a prior trusted-device
  grant. Removing all management authority does not automatically disable MFA.
- Optional mobile MFA, email OTP, and SMS MFA are not part of the Initial release.
- Security and account-recovery communications cannot be disabled.
- User impersonation is prohibited.

## Account Closure

Account Closure deletes or irreversibly disconnects:

- authentication and contact data;
- Player Profile and Equipment Profile;
- Player Availability;
- device tokens;
- direct social data;
- pending requests and invitations where history is unnecessary.

Completed Club and competition history remains under a non-identifying Player reference. Only legally necessary audit and security data remains for a documented retention period.

Guardian consent withdrawal applies the same workflow to a Junior account.

## Legal boundary

The Initial release is Costa Rica-only. Before launch, Costa Rican counsel must validate consent text, database registration obligations, retention periods, privacy notices, incident response, and Guardian verification.
