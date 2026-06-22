import { canPerformClubAction } from '../permissions';

describe('club permissions', () => {
  it('allows platform administrators to perform every action without a membership', () => {
    expect(canPerformClubAction('platform-admin', null, 'club.manage')).toBe(true);
    expect(canPerformClubAction('platform-admin', null, 'members.manage')).toBe(true);
  });

  it('keeps club settings owner-only', () => {
    expect(canPerformClubAction('user', 'owner', 'club.manage')).toBe(true);
    expect(canPerformClubAction('user', 'admin', 'club.manage')).toBe(false);
  });

  it('allows owners and admins to manage members', () => {
    expect(canPerformClubAction('user', 'owner', 'members.manage')).toBe(true);
    expect(canPerformClubAction('user', 'admin', 'members.manage')).toBe(true);
    expect(canPerformClubAction('user', 'coach', 'members.manage')).toBe(false);
  });

  it('allows coaches to view availability and organize sessions', () => {
    expect(canPerformClubAction('user', 'coach', 'availability.view')).toBe(true);
    expect(canPerformClubAction('user', 'coach', 'session.create')).toBe(true);
    expect(canPerformClubAction('user', 'coach', 'tournament.manage')).toBe(false);
  });

  it('does not grant club access without a role', () => {
    expect(canPerformClubAction('user', null, 'club.view')).toBe(false);
  });
});
