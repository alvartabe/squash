export type PlatformRole = 'user' | 'platform-admin';
export type ClubRole = 'owner' | 'admin' | 'coach' | 'player';
export type ClubAction =
  | 'club.view'
  | 'club.manage'
  | 'members.manage'
  | 'availability.view'
  | 'tournament.manage'
  | 'results.correct'
  | 'session.create';

const permissions: Record<ClubRole, ReadonlySet<ClubAction>> = {
  owner: new Set([
    'club.view',
    'club.manage',
    'members.manage',
    'availability.view',
    'tournament.manage',
    'results.correct',
    'session.create',
  ]),
  admin: new Set([
    'club.view',
    'members.manage',
    'availability.view',
    'tournament.manage',
    'results.correct',
    'session.create',
  ]),
  coach: new Set(['club.view', 'availability.view', 'session.create']),
  player: new Set(['club.view', 'session.create']),
};

export const clubActions: readonly ClubAction[] = [
  'club.view',
  'club.manage',
  'members.manage',
  'availability.view',
  'tournament.manage',
  'results.correct',
  'session.create',
];

export function canPerformClubAction(
  platformRole: PlatformRole,
  clubRole: ClubRole | null,
  action: ClubAction,
): boolean {
  return (
    platformRole === 'platform-admin' || (clubRole !== null && permissions[clubRole].has(action))
  );
}
