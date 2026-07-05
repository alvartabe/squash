'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClubInvitation,
  ClubMember,
  ClubResponsibility,
  ClubSummary,
  CreateClubInput,
  InviteClubResponsibility,
  MembershipStatus,
  PaginatedData,
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
};

export function useWorkspaceMe() {
  return useQuery<WorkspaceMe>({
    queryKey: workspaceKeys.me,
    queryFn: async () => (await api.get('/me')).data.data,
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
      client.invalidateQueries({ queryKey: ['open-play-sessions'] });
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
      client.invalidateQueries({ queryKey: ['open-play-sessions'] });
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
