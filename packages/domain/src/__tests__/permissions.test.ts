import { canPerformClubAction } from '../permissions';

describe('club permissions', () => {
  it('limits routine archival to an active Club Owner while allowing Platform restoration', () => {
    expect(canPerformClubAction('platform-admin', null, [], 'club.archive')).toBe(false);
    expect(canPerformClubAction('platform-admin', null, [], 'club.restore')).toBe(true);
    expect(canPerformClubAction('user', 'active', ['owner'], 'club.restore')).toBe(true);
    expect(canPerformClubAction('user', 'active', ['admin'], 'club.restore')).toBe(false);
    expect(canPerformClubAction('platform-admin', null, [], 'members.manage')).toBe(true);
  });

  it('lets Owners and Administrators update the Club Profile but keeps archival Owner-only', () => {
    expect(canPerformClubAction('user', 'active', ['owner'], 'club.update')).toBe(true);
    expect(canPerformClubAction('user', 'active', ['admin'], 'club.update')).toBe(true);
    expect(canPerformClubAction('user', 'active', ['owner'], 'club.archive')).toBe(true);
    expect(canPerformClubAction('user', 'active', ['admin'], 'club.archive')).toBe(false);
    expect(canPerformClubAction('user', 'active', ['coach'], 'club.update')).toBe(false);
    expect(canPerformClubAction('user', 'active', [], 'club.update')).toBe(false);
    expect(canPerformClubAction('platform-admin', null, [], 'club.update')).toBe(false);
  });

  it.each([
    ['Club Administrator', 'user', 'active', ['admin'], false],
    ['Coach', 'user', 'active', ['coach'], false],
    ['ordinary Player', 'user', 'active', [], false],
    ['suspended Owner', 'user', 'suspended', ['owner'], false],
    ['ended Owner', 'user', 'ended', ['owner'], false],
    ['Platform Administrator', 'platform-admin', null, [], false],
    ['active Club Owner', 'user', 'active', ['owner'], true],
  ] as const)(
    'evaluates archive authorization for an %s',
    (_label, platformRole, membershipStatus, responsibilities, expected) => {
      expect(
        canPerformClubAction(platformRole, membershipStatus, responsibilities, 'club.archive'),
      ).toBe(expected);
    },
  );

  it.each([
    ['Club Owner', 'user', 'active', ['owner'], true],
    ['Platform Administrator', 'platform-admin', null, [], true],
    ['Club Administrator', 'user', 'active', ['admin'], false],
    ['Coach', 'user', 'active', ['coach'], false],
    ['ordinary Player', 'user', 'active', [], false],
    ['suspended Owner', 'user', 'suspended', ['owner'], false],
    ['ended Owner', 'user', 'ended', ['owner'], false],
  ] as const)(
    'evaluates restore authorization for an %s',
    (_label, platformRole, membershipStatus, responsibilities, expected) => {
      expect(
        canPerformClubAction(platformRole, membershipStatus, responsibilities, 'club.restore'),
      ).toBe(expected);
    },
  );

  it('allows owners and admins to manage members', () => {
    expect(canPerformClubAction('user', 'active', ['owner'], 'members.manage')).toBe(true);
    expect(canPerformClubAction('user', 'active', ['admin'], 'members.manage')).toBe(true);
    expect(canPerformClubAction('user', 'active', ['coach'], 'members.manage')).toBe(false);
  });

  it('allows only Owners and Administrators to review Membership Requests', () => {
    expect(canPerformClubAction('user', 'active', ['owner'], 'membership-requests.review')).toBe(
      true,
    );
    expect(canPerformClubAction('user', 'active', ['admin'], 'membership-requests.review')).toBe(
      true,
    );
    expect(canPerformClubAction('user', 'active', ['coach'], 'membership-requests.review')).toBe(
      false,
    );
    expect(canPerformClubAction('user', 'active', [], 'membership-requests.review')).toBe(false);
    expect(canPerformClubAction('platform-admin', null, [], 'membership-requests.review')).toBe(
      false,
    );
    expect(
      canPerformClubAction(
        'platform-admin',
        'active',
        ['coach', 'admin'],
        'membership-requests.review',
      ),
    ).toBe(true);
  });

  it('allows coaches to view availability and organize sessions', () => {
    expect(canPerformClubAction('user', 'active', ['coach'], 'availability.view')).toBe(true);
    expect(canPerformClubAction('user', 'active', ['coach'], 'session.create')).toBe(true);
    expect(canPerformClubAction('user', 'active', ['coach'], 'tournament.manage')).toBe(false);
  });

  it('unions permissions from independently assigned responsibilities', () => {
    expect(canPerformClubAction('user', 'active', ['admin', 'coach'], 'members.manage')).toBe(true);
    expect(canPerformClubAction('user', 'active', ['admin', 'coach'], 'session.create')).toBe(true);
  });

  it('allows an active member without responsibilities to view the club only', () => {
    expect(canPerformClubAction('user', 'active', [], 'club.view')).toBe(true);
    expect(canPerformClubAction('user', 'active', [], 'session.create')).toBe(false);
  });

  it.each(['suspended', 'ended'] as const)(
    'denies club access to a %s membership even when responsibilities are retained',
    (status) => {
      expect(canPerformClubAction('user', status, ['owner', 'admin', 'coach'], 'club.view')).toBe(
        false,
      );
      expect(
        canPerformClubAction('user', status, ['owner', 'admin', 'coach'], 'members.manage'),
      ).toBe(false);
    },
  );

  it('does not grant club access without an active membership', () => {
    expect(canPerformClubAction('user', null, [], 'club.view')).toBe(false);
  });
});
