import { render, screen } from '@testing-library/react';
import type { ClubResponsibility, MembershipStatus } from '@squash/contracts';
import type { ClubDetails, WorkspaceMe } from '@/src/hooks/workspace';
import { MembersPage } from './members-page';

jest.mock('@tanstack/react-pacer', () => ({
  useDebouncedValue: (value: string) => [value],
}));

jest.mock('@/src/locale-provider', () => {
  const { translate } = jest.requireActual('@squash/i18n') as typeof import('@squash/i18n');
  return {
    useLocale: () => ({
      locale: 'en-US',
      t: (key: Parameters<typeof translate>[1]) => translate('en-US', key),
    }),
  };
});

jest.mock('./invite-member-drawer', () => ({
  InviteMemberDrawer: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/src/hooks/membership-requests', () => ({
  membershipRequestErrorCode: jest.fn(),
  useApproveMembershipRequest: jest.fn(() => ({
    isPending: false,
    mutateAsync: jest.fn(),
  })),
  usePendingMembershipRequests: jest.fn(() => ({
    data: { items: [], page: 0, pageSize: 15, total: 0, totalPages: 0 },
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: jest.fn(),
  })),
  useRejectMembershipRequest: jest.fn(() => ({
    isPending: false,
    mutateAsync: jest.fn(),
  })),
}));

jest.mock('@/src/hooks/workspace', () => ({
  useClubInvitations: jest.fn(),
  useClubMembers: jest.fn(),
  useRemoveClubMember: jest.fn(),
  useResendClubInvitation: jest.fn(),
  useRevokeClubInvitation: jest.fn(),
  useTransferClubOwnership: jest.fn(),
  useUpdateClubMember: jest.fn(),
  useWorkspaceClub: jest.fn(),
  useWorkspaceMe: jest.fn(),
}));

const workspaceHooks = jest.requireMock('@/src/hooks/workspace') as {
  useClubInvitations: jest.Mock;
  useClubMembers: jest.Mock;
  useRemoveClubMember: jest.Mock;
  useResendClubInvitation: jest.Mock;
  useRevokeClubInvitation: jest.Mock;
  useTransferClubOwnership: jest.Mock;
  useUpdateClubMember: jest.Mock;
  useWorkspaceClub: jest.Mock;
  useWorkspaceMe: jest.Mock;
};
const clubId = 'bd8749bd-8b32-4fd2-a96e-5413de2057cc';
const emptyPage = { items: [], page: 0, pageSize: 15, total: 0, totalPages: 0 };
const mutation = { isPending: false, mutateAsync: jest.fn() };

const me: WorkspaceMe = {
  user: {
    id: 'current-player',
    name: 'Current Player',
    email: 'current@example.com',
    image: null,
    role: 'user',
    locale: 'en-US',
    timeZone: 'America/Costa_Rica',
  },
  platformAdmin: false,
  workspaceAccess: true,
  memberships: [],
};

function club(
  membershipStatus: MembershipStatus | null,
  responsibilities: ClubResponsibility[],
): ClubDetails {
  return {
    id: clubId,
    name: 'Central Squash Club',
    slug: 'central-squash-club',
    logoAssetId: null,
    logoUrl: null,
    description: null,
    physicalAddress: 'San José',
    mapLink: null,
    contactEmail: 'club@example.com',
    contactPhone: null,
    timeZone: 'America/Costa_Rica',
    archivedAt: null,
    memberCount: 12,
    membershipStatus,
    responsibilities,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-04T00:00:00.000Z',
  };
}

describe('MembersPage Membership Request integration', () => {
  beforeEach(() => {
    workspaceHooks.useClubMembers.mockReturnValue({ data: emptyPage, isLoading: false });
    workspaceHooks.useClubInvitations.mockReturnValue({ data: emptyPage, isLoading: false });
    workspaceHooks.useWorkspaceMe.mockReturnValue({ data: me });
    workspaceHooks.useRemoveClubMember.mockReturnValue(mutation);
    workspaceHooks.useResendClubInvitation.mockReturnValue(mutation);
    workspaceHooks.useRevokeClubInvitation.mockReturnValue(mutation);
    workspaceHooks.useTransferClubOwnership.mockReturnValue(mutation);
    workspaceHooks.useUpdateClubMember.mockReturnValue(mutation);
  });

  it.each([
    ['Club Owner', ['owner']],
    ['Club Administrator', ['admin']],
  ] as const)('shows the section to an active %s', (_label, responsibilities) => {
    workspaceHooks.useWorkspaceClub.mockReturnValue({
      data: club('active', [...responsibilities]),
    });
    workspaceHooks.useWorkspaceMe.mockReturnValue({
      data: {
        ...me,
        memberships: [
          {
            clubId,
            clubName: 'Central Squash Club',
            clubSlug: 'central-squash-club',
            clubTimeZone: 'America/Costa_Rica',
            membershipStatus: 'active',
            responsibilities: [...responsibilities],
            permissions: ['members.manage', 'membership-requests.review'],
          },
        ],
      },
    });

    render(<MembersPage clubId={clubId} />);

    expect(screen.getByText('Pending Membership Requests')).toBeInTheDocument();
  });

  it.each([
    ['Coach', 'active', ['coach'], false],
    ['ordinary Player', 'active', [], false],
    ['suspended Club Owner', 'suspended', ['owner'], false],
    ['ended Club Administrator', 'ended', ['admin'], false],
    ['Platform Administrator without a Club responsibility', null, [], true],
  ] as const)(
    'hides the section from a %s',
    (_label, membershipStatus, responsibilities, platformAdmin) => {
      workspaceHooks.useWorkspaceClub.mockReturnValue({
        data: club(membershipStatus, [...responsibilities]),
      });
      workspaceHooks.useWorkspaceMe.mockReturnValue({
        data: {
          ...me,
          platformAdmin,
          user: {
            ...me.user,
            role: platformAdmin ? 'platform-admin' : 'user',
          },
          memberships:
            membershipStatus === 'active'
              ? [
                  {
                    clubId,
                    clubName: 'Central Squash Club',
                    clubSlug: 'central-squash-club',
                    clubTimeZone: 'America/Costa_Rica',
                    membershipStatus,
                    responsibilities: [...responsibilities],
                    permissions: [],
                  },
                ]
              : [],
        },
      });

      render(<MembersPage clubId={clubId} />);

      expect(screen.queryByText('Pending Membership Requests')).not.toBeInTheDocument();
    },
  );
});
