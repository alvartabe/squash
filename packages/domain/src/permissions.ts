export type PlatformRole = 'user' | 'platform-admin';
export type MembershipStatus = 'active' | 'suspended' | 'ended';
export type ClubResponsibility = 'owner' | 'admin' | 'coach';
export type ClubAction =
  | 'club.view'
  | 'club.update'
  | 'club.archive'
  | 'members.manage'
  | 'membership-requests.review'
  | 'availability.view'
  | 'tournament.manage'
  | 'results.correct'
  | 'session.create';

const memberPermissions: ReadonlySet<ClubAction> = new Set(['club.view']);

const permissions: Record<ClubResponsibility, ReadonlySet<ClubAction>> = {
  owner: new Set([
    'club.view',
    'club.update',
    'club.archive',
    'members.manage',
    'membership-requests.review',
    'availability.view',
    'tournament.manage',
    'results.correct',
    'session.create',
  ]),
  admin: new Set([
    'club.view',
    'club.update',
    'members.manage',
    'membership-requests.review',
    'availability.view',
    'tournament.manage',
    'results.correct',
    'session.create',
  ]),
  coach: new Set(['club.view', 'availability.view', 'session.create']),
};

export const clubActions: readonly ClubAction[] = [
  'club.view',
  'club.update',
  'club.archive',
  'members.manage',
  'membership-requests.review',
  'availability.view',
  'tournament.manage',
  'results.correct',
  'session.create',
];

export function canPerformClubAction(
  platformRole: PlatformRole,
  membershipStatus: MembershipStatus | null,
  responsibilities: readonly ClubResponsibility[],
  action: ClubAction,
): boolean {
  if (action === 'club.update' || action === 'membership-requests.review') {
    return (
      membershipStatus === 'active' &&
      responsibilities.some(
        (responsibility) => responsibility === 'owner' || responsibility === 'admin',
      )
    );
  }
  if (platformRole === 'platform-admin') return true;
  if (membershipStatus !== 'active') return false;
  return (
    memberPermissions.has(action) ||
    responsibilities.some((responsibility) => permissions[responsibility].has(action))
  );
}
