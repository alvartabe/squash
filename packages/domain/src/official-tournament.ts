export type OfficialTournamentVisibility = 'club-only' | 'public';
export type OfficialTournamentStatus =
  | 'draft'
  | 'registration'
  | 'group-stage'
  | 'knockout'
  | 'completed'
  | 'cancelled';
export type OfficialTournamentRelationship = 'none' | 'request-pending' | 'invited' | 'accepted';

export function isOfficialTournamentAudienceMember(
  visibility: OfficialTournamentVisibility,
  hasActiveOwningClubMembership: boolean,
) {
  return visibility === 'public' || hasActiveOwningClubMembership;
}

export function canViewOfficialTournamentForPlayer(input: {
  status: OfficialTournamentStatus;
  visibility: OfficialTournamentVisibility;
  hasActiveOwningClubMembership: boolean;
  relationship: OfficialTournamentRelationship;
}) {
  if (input.status === 'draft') return false;
  return (
    isOfficialTournamentAudienceMember(input.visibility, input.hasActiveOwningClubMembership) ||
    input.relationship === 'accepted'
  );
}

export function canRequestOfficialTournamentEntry(input: {
  status: OfficialTournamentStatus;
  visibility: OfficialTournamentVisibility;
  hasActiveOwningClubMembership: boolean;
}) {
  return (
    input.status === 'registration' &&
    isOfficialTournamentAudienceMember(input.visibility, input.hasActiveOwningClubMembership)
  );
}

export function canManageOfficialTournament(input: {
  membershipStatus: 'active' | 'suspended' | 'ended' | null;
  responsibilities: readonly ('owner' | 'admin' | 'coach')[];
  explicitlyAppointed: boolean;
}) {
  if (input.membershipStatus !== 'active') return false;
  return (
    input.responsibilities.includes('owner') ||
    input.responsibilities.includes('admin') ||
    (input.responsibilities.includes('coach') && input.explicitlyAppointed)
  );
}

export function isOfficialTournamentRosterMutable(status: OfficialTournamentStatus) {
  return status === 'draft' || status === 'registration';
}

export function isOfficialTournamentChampionValid(
  status: OfficialTournamentStatus,
  championId: string | null,
) {
  return status === 'completed' ? championId !== null : championId === null;
}
