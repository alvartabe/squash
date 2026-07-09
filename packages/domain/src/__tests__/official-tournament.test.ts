import {
  canListOfficialTournamentForPlayer,
  canManageOfficialTournament,
  canRequestOfficialTournamentEntry,
  isOfficialTournamentRosterMutable,
} from '../official-tournament';

describe('Official Tournament discovery and entry policy', () => {
  it('limits Club-only discovery to active owning-Club members', () => {
    expect(
      canListOfficialTournamentForPlayer({
        status: 'registration',
        visibility: 'club-only',
        hasActiveOwningClubMembership: true,
        relationship: 'none',
      }),
    ).toBe(true);
    expect(
      canListOfficialTournamentForPlayer({
        status: 'registration',
        visibility: 'club-only',
        hasActiveOwningClubMembership: false,
        relationship: 'none',
      }),
    ).toBe(false);
  });

  it('allows every registered audience, including cross-Club and clubless Players, into Public discovery', () => {
    expect(
      canRequestOfficialTournamentEntry({
        status: 'registration',
        visibility: 'public',
        hasActiveOwningClubMembership: false,
      }),
    ).toBe(true);
  });

  it('never exposes a Draft to Players', () => {
    expect(
      canListOfficialTournamentForPlayer({
        status: 'draft',
        visibility: 'public',
        hasActiveOwningClubMembership: true,
        relationship: 'accepted',
      }),
    ).toBe(false);
  });

  it.each(['invited', 'request-pending', 'accepted'] as const)(
    'keeps a %s relationship reachable after visibility or Membership changes',
    (relationship) => {
      expect(
        canListOfficialTournamentForPlayer({
          status: 'registration',
          visibility: 'club-only',
          hasActiveOwningClubMembership: false,
          relationship,
        }),
      ).toBe(true);
    },
  );
});

describe('Official Tournament management and roster lock policy', () => {
  it('allows Owners and Administrators implicitly but Coaches only when appointed', () => {
    expect(
      canManageOfficialTournament({
        membershipStatus: 'active',
        responsibilities: ['owner'],
        explicitlyAppointed: false,
      }),
    ).toBe(true);
    expect(
      canManageOfficialTournament({
        membershipStatus: 'active',
        responsibilities: ['admin'],
        explicitlyAppointed: false,
      }),
    ).toBe(true);
    expect(
      canManageOfficialTournament({
        membershipStatus: 'active',
        responsibilities: ['coach'],
        explicitlyAppointed: false,
      }),
    ).toBe(false);
    expect(
      canManageOfficialTournament({
        membershipStatus: 'active',
        responsibilities: ['coach'],
        explicitlyAppointed: true,
      }),
    ).toBe(true);
  });

  it('locks accepted-roster mutations at Tournament Start', () => {
    expect(isOfficialTournamentRosterMutable('draft')).toBe(true);
    expect(isOfficialTournamentRosterMutable('registration')).toBe(true);
    expect(isOfficialTournamentRosterMutable('group-stage')).toBe(false);
    expect(isOfficialTournamentRosterMutable('knockout')).toBe(false);
  });
});
