import {
  canManageOfficialTournament,
  canRequestOfficialTournamentEntry,
  canViewOfficialTournamentForPlayer,
  isOfficialTournamentChampionValid,
  isOfficialTournamentRosterMutable,
} from '../official-tournament';

describe('Official Tournament discovery and entry policy', () => {
  it('limits Club-only discovery to active owning-Club members', () => {
    expect(
      canViewOfficialTournamentForPlayer({
        status: 'registration',
        visibility: 'club-only',
        hasActiveOwningClubMembership: true,
        relationship: 'none',
      }),
    ).toBe(true);
    expect(
      canViewOfficialTournamentForPlayer({
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
      canViewOfficialTournamentForPlayer({
        status: 'draft',
        visibility: 'public',
        hasActiveOwningClubMembership: true,
        relationship: 'accepted',
      }),
    ).toBe(false);
  });

  it('keeps accepted Tournament Participation reachable through completion', () => {
    expect(
      canViewOfficialTournamentForPlayer({
        status: 'completed',
        visibility: 'club-only',
        hasActiveOwningClubMembership: false,
        relationship: 'accepted',
      }),
    ).toBe(true);
  });

  it('does not authorize detail through a pending registration relationship', () => {
    for (const relationship of ['invited', 'request-pending'] as const) {
      expect(
        canViewOfficialTournamentForPlayer({
          status: 'registration',
          visibility: 'club-only',
          hasActiveOwningClubMembership: false,
          relationship,
        }),
      ).toBe(false);
    }
  });

  it('does not extend Club-only list visibility through a pending invitation', () => {
    expect(
      canViewOfficialTournamentForPlayer({
        status: 'registration',
        visibility: 'club-only',
        hasActiveOwningClubMembership: false,
        relationship: 'invited',
      }),
    ).toBe(false);
  });
});

describe('Official Tournament management and roster lock policy', () => {
  it('allows a champion only for a Completed Tournament', () => {
    expect(isOfficialTournamentChampionValid('completed', 'player-1')).toBe(true);
    expect(isOfficialTournamentChampionValid('completed', null)).toBe(false);
    expect(isOfficialTournamentChampionValid('cancelled', null)).toBe(true);
    expect(isOfficialTournamentChampionValid('cancelled', 'player-1')).toBe(false);
  });

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
