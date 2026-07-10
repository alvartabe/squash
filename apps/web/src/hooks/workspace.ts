'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClubInvitation,
  ClubMember,
  ClubPlaySession,
  ClubResponsibility,
  ClubSummary,
  CreateClubInput,
  InviteClubResponsibility,
  MembershipStatus,
  PaginatedData,
  TournamentManagement,
  TournamentPlayerCandidate,
  TournamentVisibility,
  UpdateClubInput,
} from '@squash/contracts';
import { api } from '@/src/lib/api';

export type WorkspaceMe = {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: 'user' | 'platform-admin';
    locale: string;
    timeZone: string;
  };
  platformAdmin: boolean;
  workspaceAccess: boolean;
  memberships: Array<{
    clubId: string;
    clubName: string;
    clubSlug: string;
    clubTimeZone: string | null;
    membershipStatus: MembershipStatus;
    responsibilities: ClubResponsibility[];
    permissions: string[];
  }>;
};

export type ClubDetails = {
  id: string;
  name: string;
  slug: string;
  logoAssetId: string | null;
  logoUrl: string | null;
  description: string | null;
  physicalAddress: string | null;
  mapLink: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  timeZone: string | null;
  archivedAt: string | null;
  memberCount: number;
  membershipStatus: MembershipStatus | null;
  responsibilities: ClubResponsibility[];
  createdAt: string;
  updatedAt: string;
};

export const workspaceKeys = {
  me: ['workspace', 'me'] as const,
  clubs: (page: number, pageSize: number, search: string, includeArchived: boolean) =>
    ['workspace', 'clubs', page, pageSize, search, includeArchived] as const,
  club: (clubId: string) => ['workspace', 'club', clubId] as const,
  members: (clubId: string, page: number, pageSize: number, search: string) =>
    ['workspace', 'club', clubId, 'members', page, pageSize, search] as const,
  invitations: (clubId: string, page: number, pageSize: number, search: string) =>
    ['workspace', 'club', clubId, 'invitations', page, pageSize, search] as const,
  sessions: (clubId: string) => ['workspace', 'club', clubId, 'sessions'] as const,
  sessionCandidates: (sessionId: string) =>
    ['workspace', 'club-play-session', sessionId, 'candidates'] as const,
  tournaments: (clubId: string) => ['workspace', 'club', clubId, 'tournaments'] as const,
  tournamentCandidates: (tournamentId: string, search: string) =>
    ['workspace', 'tournament', tournamentId, 'candidates', search] as const,
};

export function useWorkspaceMe() {
  return useQuery<WorkspaceMe>({
    queryKey: workspaceKeys.me,
    queryFn: async () => (await api.get('/me')).data.data,
  });
}

export function useClubTournaments(clubId: string) {
  return useQuery<TournamentManagement[]>({
    queryKey: workspaceKeys.tournaments(clubId),
    enabled: Boolean(clubId),
    queryFn: async () => (await api.get(`/clubs/${clubId}/tournaments`)).data.data,
    refetchInterval: (query) =>
      query.state.data?.some((tournament) =>
        ['group-stage', 'knockout'].includes(tournament.status),
      )
        ? 2_000
        : false,
  });
}

function useInvalidateTournaments(clubId: string) {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: workspaceKeys.tournaments(clubId) });
    client.invalidateQueries({ queryKey: ['tournaments'] });
  };
}

export function useCreateTournament(clubId: string) {
  const invalidate = useInvalidateTournaments(clubId);
  return useMutation({
    mutationFn: async (input: {
      name: string;
      visibility: TournamentVisibility;
      startsAt: string;
      timeZone: string;
      groupSize: number;
      qualifiersPerGroup: number;
      wildcardQualifiers: number;
      seedingMethod: 'random' | 'manual';
      rules: { bestOf: 1 | 3 | 5; pointsToWin: number; winByTwo: boolean };
    }) => (await api.post('/tournaments', { clubId, ...input })).data.data,
    onSuccess: invalidate,
  });
}

export function useTournamentAction(clubId: string) {
  const invalidate = useInvalidateTournaments(clubId);
  return useMutation({
    mutationFn: async ({
      method = 'post',
      path,
      data,
    }: {
      method?: 'post' | 'patch' | 'delete';
      path: string;
      data?: unknown;
    }) => (await api.request({ method, url: path, data })).data.data,
    onSuccess: invalidate,
  });
}

export function useTournamentCandidates(tournamentId: string, search: string) {
  return useQuery<TournamentPlayerCandidate[]>({
    queryKey: workspaceKeys.tournamentCandidates(tournamentId, search),
    enabled: Boolean(tournamentId),
    queryFn: async () =>
      (await api.get(`/tournaments/${tournamentId}/player-candidates`, { params: { search } })).data
        .data,
  });
}

export function useWorkspaceClubs(input: {
  page: number;
  pageSize: number;
  search: string;
  includeArchived: boolean;
}) {
  return useQuery<PaginatedData<ClubSummary>>({
    queryKey: workspaceKeys.clubs(input.page, input.pageSize, input.search, input.includeArchived),
    queryFn: async () => (await api.get('/clubs', { params: input })).data.data,
  });
}

export function useWorkspaceClub(clubId: string) {
  return useQuery<ClubDetails>({
    queryKey: workspaceKeys.club(clubId),
    enabled: Boolean(clubId),
    queryFn: async () => (await api.get(`/clubs/${clubId}`)).data.data,
  });
}

export function useCreateClub() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateClubInput) => (await api.post('/clubs', input)).data.data,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['workspace', 'clubs'] });
      client.invalidateQueries({ queryKey: workspaceKeys.me });
    },
  });
}

export function useUpdateClub(clubId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateClubInput) =>
      (await api.patch(`/clubs/${clubId}`, input)).data.data,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['workspace', 'clubs'] });
      client.invalidateQueries({ queryKey: workspaceKeys.club(clubId) });
      client.invalidateQueries({ queryKey: workspaceKeys.me });
    },
  });
}

export function useArchiveClub(clubId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.delete(`/clubs/${clubId}`)).data.data,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['workspace', 'clubs'] });
      client.invalidateQueries({ queryKey: ['workspace', 'club', clubId] });
      client.invalidateQueries({ queryKey: workspaceKeys.me });
      client.invalidateQueries({ queryKey: ['clubs', clubId] });
      client.invalidateQueries({ queryKey: ['clubs', 'discovery'] });
      client.invalidateQueries({ queryKey: ['club-play-sessions'] });
      client.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
}

export function useRestoreClub(clubId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post(`/clubs/${clubId}/restore`)).data.data,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['workspace', 'clubs'] });
      client.invalidateQueries({ queryKey: ['workspace', 'club', clubId] });
      client.invalidateQueries({ queryKey: workspaceKeys.me });
      client.invalidateQueries({ queryKey: ['clubs', clubId] });
      client.invalidateQueries({ queryKey: ['clubs', 'discovery'] });
      client.invalidateQueries({ queryKey: ['club-play-sessions'] });
      client.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
}

export function useClubMembers(
  clubId: string,
  input: { page: number; pageSize: number; search: string },
) {
  return useQuery<PaginatedData<ClubMember>>({
    queryKey: workspaceKeys.members(clubId, input.page, input.pageSize, input.search),
    enabled: Boolean(clubId),
    queryFn: async () => (await api.get(`/clubs/${clubId}/members`, { params: input })).data.data,
  });
}

export function useClubInvitations(
  clubId: string,
  input: { page: number; pageSize: number; search: string },
) {
  return useQuery<PaginatedData<ClubInvitation>>({
    queryKey: workspaceKeys.invitations(clubId, input.page, input.pageSize, input.search),
    enabled: Boolean(clubId),
    queryFn: async () =>
      (await api.get(`/clubs/${clubId}/invitations`, { params: input })).data.data,
  });
}

function useInvalidateMembers(clubId: string) {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: ['workspace', 'club', clubId, 'members'] });
    client.invalidateQueries({ queryKey: ['workspace', 'club', clubId, 'invitations'] });
    client.invalidateQueries({ queryKey: workspaceKeys.club(clubId) });
    client.invalidateQueries({ queryKey: workspaceKeys.me });
  };
}

export function useInviteClubMember(clubId: string) {
  const invalidate = useInvalidateMembers(clubId);
  return useMutation({
    mutationFn: async (input: {
      email: string;
      responsibility: InviteClubResponsibility;
      locale: 'en-US' | 'es-419';
    }) => (await api.post(`/clubs/${clubId}/invitations`, input)).data.data,
    onSuccess: invalidate,
  });
}

export function useUpdateClubMember(clubId: string) {
  const invalidate = useInvalidateMembers(clubId);
  return useMutation({
    mutationFn: async ({
      userId,
      ...input
    }: {
      userId: string;
      status?: MembershipStatus;
      responsibilities?: ClubResponsibility[];
    }) => (await api.patch(`/clubs/${clubId}/members/${userId}`, input)).data.data,
    onSuccess: invalidate,
  });
}

export function useRemoveClubMember(clubId: string) {
  const invalidate = useInvalidateMembers(clubId);
  return useMutation({
    mutationFn: async (userId: string) =>
      (await api.delete(`/clubs/${clubId}/members/${userId}`)).data.data,
    onSuccess: invalidate,
  });
}

export function useTransferClubOwnership(clubId: string) {
  const invalidate = useInvalidateMembers(clubId);
  return useMutation({
    mutationFn: async (userId: string) =>
      (await api.post(`/clubs/${clubId}/transfer-ownership`, { userId })).data.data,
    onSuccess: invalidate,
  });
}

export function useResendClubInvitation(clubId: string) {
  const invalidate = useInvalidateMembers(clubId);
  return useMutation({
    mutationFn: async ({ invitationId, locale }: { invitationId: string; locale: string }) =>
      (await api.post(`/clubs/${clubId}/invitations/${invitationId}/resend`, { locale })).data.data,
    onSuccess: invalidate,
  });
}

export function useRevokeClubInvitation(clubId: string) {
  const invalidate = useInvalidateMembers(clubId);
  return useMutation({
    mutationFn: async (invitationId: string) =>
      (await api.delete(`/clubs/${clubId}/invitations/${invitationId}`)).data.data,
    onSuccess: invalidate,
  });
}

function useInvalidateClubPlaySessions(clubId: string) {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: workspaceKeys.sessions(clubId) });
    client.invalidateQueries({ queryKey: ['workspace', 'club-play-session'] });
    client.invalidateQueries({ queryKey: ['club-play-sessions'] });
  };
}

export function useClubPlaySessions(clubId: string) {
  return useQuery<ClubPlaySession[]>({
    queryKey: workspaceKeys.sessions(clubId),
    enabled: Boolean(clubId),
    queryFn: async () =>
      (await api.get(`/clubs/${clubId}/play-sessions`, { params: { scope: 'all' } })).data.data,
  });
}

export function useCreateClubPlaySession(clubId: string) {
  const invalidate = useInvalidateClubPlaySessions(clubId);
  return useMutation({
    mutationFn: async (input: {
      title: string;
      notes?: string | null;
      startsAtLocal: string;
      endsAtLocal: string;
    }) => (await api.post(`/clubs/${clubId}/play-sessions`, input)).data.data,
    onSuccess: invalidate,
  });
}

export function useUpdateClubPlaySession(clubId: string) {
  const invalidate = useInvalidateClubPlaySessions(clubId);
  return useMutation({
    mutationFn: async ({
      sessionId,
      ...input
    }: {
      sessionId: string;
      expectedVersion: number;
      title: string;
      notes: string | null;
      startsAtLocal: string;
      endsAtLocal: string;
    }) => (await api.patch(`/club-play-sessions/${sessionId}`, input)).data.data,
    onSettled: invalidate,
  });
}

export function useCancelClubPlaySession(clubId: string) {
  const invalidate = useInvalidateClubPlaySessions(clubId);
  return useMutation({
    mutationFn: async ({
      sessionId,
      expectedVersion,
    }: {
      sessionId: string;
      expectedVersion: number;
    }) =>
      (
        await api.delete(`/club-play-sessions/${sessionId}`, {
          data: { expectedVersion },
        })
      ).data.data,
    onSettled: invalidate,
  });
}

export function useClubPlaySessionInviteCandidates(sessionId: string, enabled: boolean) {
  return useQuery<Array<{ playerId: string; playerName: string; playerImage: string | null }>>({
    queryKey: workspaceKeys.sessionCandidates(sessionId),
    enabled: Boolean(sessionId && enabled),
    queryFn: async () => (await api.get(`/club-play-sessions/${sessionId}/participants`)).data.data,
  });
}

export function useInviteClubPlaySessionParticipants(clubId: string, sessionId: string) {
  const invalidate = useInvalidateClubPlaySessions(clubId);
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { playerIds: string[]; expectedVersion: number }) =>
      (await api.post(`/club-play-sessions/${sessionId}/participants`, input)).data.data,
    onSettled: () => {
      invalidate();
      client.invalidateQueries({ queryKey: workspaceKeys.sessionCandidates(sessionId) });
    },
  });
}
