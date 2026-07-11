export type PlatformRole = 'user' | 'platform-admin';
export type MembershipStatus = 'active' | 'suspended' | 'ended';
export type ClubResponsibility = 'owner' | 'admin' | 'coach';
export type ClubAction =
  | 'club.view'
  | 'club.update'
  | 'club.archive'
  | 'club.restore'
  | 'club.transfer-ownership'
  | 'members.manage'
  | 'members.manage-administrator'
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
    'club.restore',
    'club.transfer-ownership',
    'members.manage',
    'members.manage-administrator',
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
  'club.restore',
  'club.transfer-ownership',
  'members.manage',
  'members.manage-administrator',
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
  const membershipAllows =
    membershipStatus === 'active' &&
    (memberPermissions.has(action) ||
      responsibilities.some((responsibility) => permissions[responsibility].has(action)));
  if (membershipAllows) return true;
  return (
    platformRole === 'platform-admin' &&
    (action === 'club.view' ||
      action === 'club.restore' ||
      action === 'club.transfer-ownership')
  );
}
