import type {
  CreateChallengeInput,
  CreateClubInput,
  ClubPlaySession,
  CreateTournamentInput,
  ClubDiscoveryItem,
  ClubInvitation,
  ClubMember,
  ClubProfileDetail,
  ClubSummary,
  InviteClubResponsibility,
  MembershipRequest,
  MembershipRequestStatus,
  PaginatedData,
  PlayerProfile,
  PlayerStatistics,
  TournamentPlayer,
  TournamentPlayerDetail,
  UpdateClubInput,
  UpdatePlayerProfile,
} from '@squash/contracts';
import Axios, { type AxiosInstance } from 'axios';

export type ApiClientOptions = {
  baseURL: string;
  getLocale: () => 'en-US' | 'es-419';
  getTimeZone: () => string;
  getAuthCookie?: () => string | null | undefined;
};

export function createApiClient(options: ApiClientOptions): AxiosInstance {
  const client = Axios.create({
    baseURL: `${options.baseURL.replace(/\/$/, '')}/api/v1`,
    timeout: 15_000,
    withCredentials: options.getAuthCookie === undefined,
  });
  client.interceptors.request.use((config) => {
    config.headers.set('Accept-Language', options.getLocale());
    config.headers.set('X-Time-Zone', options.getTimeZone());
    config.headers.set('X-Client-Version', '0.1.0');
    const cookie = options.getAuthCookie?.();
    if (cookie) {
      config.headers.set('Cookie', cookie);
      config.withCredentials = false;
    }
    return config;
  });
  return client;
}

export function squashApi(client: AxiosInstance) {
  return {
    getMe: async () => (await client.get('/me')).data,
    getProfile: async (): Promise<{ data: PlayerProfile }> => (await client.get('/profile')).data,
    updateProfile: async (input: UpdatePlayerProfile): Promise<{ data: PlayerProfile }> =>
      (await client.put('/profile', input)).data,
    discoverClubs: async (params: {
      page?: number;
      pageSize?: number;
      search?: string;
    }): Promise<{ data: PaginatedData<ClubDiscoveryItem> }> =>
      (await client.get('/clubs/discovery', { params })).data,
    getClubProfile: async (clubId: string): Promise<{ data: ClubProfileDetail }> =>
      (await client.get(`/clubs/${clubId}/profile`)).data,
    getClubs: async (params: {
      page?: number;
      pageSize?: number;
      search?: string;
      includeArchived?: boolean;
    }): Promise<{ data: PaginatedData<ClubSummary> }> =>
      (await client.get('/clubs', { params })).data,
    createClub: async (input: CreateClubInput) => (await client.post('/clubs', input)).data,
    updateClub: async (clubId: string, input: UpdateClubInput) =>
      (await client.patch(`/clubs/${clubId}`, input)).data,
    archiveClub: async (clubId: string) => (await client.delete(`/clubs/${clubId}`)).data,
    getClubMembers: async (
      clubId: string,
      params: { page?: number; pageSize?: number; search?: string },
    ): Promise<{ data: PaginatedData<ClubMember> }> =>
      (await client.get(`/clubs/${clubId}/members`, { params })).data,
    getClubInvitations: async (
      clubId: string,
      params: { page?: number; pageSize?: number; search?: string },
    ): Promise<{ data: PaginatedData<ClubInvitation> }> =>
      (await client.get(`/clubs/${clubId}/invitations`, { params })).data,
    getMembershipRequests: async (
      clubId: string,
      params: {
        page?: number;
        pageSize?: number;
        search?: string;
        status?: MembershipRequestStatus;
      },
    ): Promise<{ data: PaginatedData<MembershipRequest> }> =>
      (await client.get(`/clubs/${clubId}/membership-requests`, { params })).data,
    submitMembershipRequest: async (clubId: string): Promise<{ data: MembershipRequest }> =>
      (await client.post(`/clubs/${clubId}/membership-requests`)).data,
    cancelMembershipRequest: async (
      clubId: string,
      requestId: string,
    ): Promise<{ data: MembershipRequest }> =>
      (await client.post(`/clubs/${clubId}/membership-requests/${requestId}/cancel`)).data,
    acceptClubInvitation: async (
      clubId: string,
      invitationId: string,
    ): Promise<{ data: { clubId: string; accepted: true } }> =>
      (await client.post(`/clubs/${clubId}/invitations/${invitationId}/accept`)).data,
    approveMembershipRequest: async (clubId: string, requestId: string) =>
      (await client.post(`/clubs/${clubId}/membership-requests/${requestId}/approve`)).data,
    rejectMembershipRequest: async (clubId: string, requestId: string) =>
      (await client.post(`/clubs/${clubId}/membership-requests/${requestId}/reject`)).data,
    inviteClubMember: async (
      clubId: string,
      input: {
        email: string;
        responsibility: InviteClubResponsibility;
        locale: 'en-US' | 'es-419';
      },
    ) => (await client.post(`/clubs/${clubId}/invitations`, input)).data,
    createChallenge: async (input: CreateChallengeInput) =>
      (await client.post('/challenges', input)).data,
    getMyClubPlaySessions: async (
      scope: 'upcoming' | 'past' | 'all' = 'upcoming',
    ): Promise<{ data: ClubPlaySession[] }> =>
      (await client.get('/club-play-sessions', { params: { scope } })).data,
    getClubPlaySession: async (sessionId: string): Promise<{ data: ClubPlaySession }> =>
      (await client.get(`/club-play-sessions/${sessionId}`)).data,
    setClubPlaySessionAttendance: async (
      sessionId: string,
      input: { response: 'going' | 'not-going'; expectedVersion: number },
    ) => (await client.put(`/club-play-sessions/${sessionId}/attendance`, input)).data,
    createTournament: async (input: CreateTournamentInput) =>
      (await client.post('/tournaments', input)).data,
    getDiscoverableTournaments: async (): Promise<{ data: TournamentPlayer[] }> =>
      (await client.get('/tournaments')).data,
    getOfficialTournament: async (
      tournamentId: string,
    ): Promise<{ data: TournamentPlayerDetail }> =>
      (await client.get(`/tournaments/${tournamentId}`)).data,
    requestTournamentEntry: async (tournamentId: string) =>
      (await client.post(`/tournaments/${tournamentId}/entry-requests`)).data,
    acceptTournamentInvitation: async (tournamentId: string, invitationId: string) =>
      (await client.post(`/tournaments/${tournamentId}/invitations/${invitationId}/accept`)).data,
    rejectTournamentInvitation: async (tournamentId: string, invitationId: string) =>
      (await client.post(`/tournaments/${tournamentId}/invitations/${invitationId}/reject`)).data,
    withdrawTournamentParticipation: async (tournamentId: string) =>
      (await client.delete(`/tournaments/${tournamentId}/participation`)).data,
    getStatistics: async (playerId: string): Promise<{ data: PlayerStatistics }> =>
      (await client.get(`/statistics/${playerId}`)).data,
    presignUpload: async (input: {
      fileName: string;
      contentType: 'image/jpeg' | 'image/png' | 'image/webp';
      contentLength: number;
      purpose: 'avatar' | 'racket' | 'club-logo';
    }) => (await client.post('/media/uploads', input)).data,
  };
}

export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  friends: () => ['friends'] as const,
  clubDiscovery: () => ['clubs', 'discovery'] as const,
  clubProfile: (clubId: string) => ['clubs', clubId, 'profile'] as const,
  clubs: () => ['clubs'] as const,
  club: (clubId: string) => ['clubs', clubId] as const,
  clubMembers: (clubId: string) => ['clubs', clubId, 'members'] as const,
  clubInvitations: (clubId: string) => ['clubs', clubId, 'invitations'] as const,
  membershipRequests: (clubId: string) => ['clubs', clubId, 'membership-requests'] as const,
  clubPlaySessions: () => ['club-play-sessions'] as const,
  clubPlaySession: (sessionId: string) => ['club-play-sessions', sessionId] as const,
  challenges: () => ['challenges'] as const,
  tournaments: () => ['tournaments'] as const,
  tournament: (tournamentId: string) => ['tournaments', tournamentId] as const,
  statistics: (playerId: string) => ['statistics', playerId] as const,
};
