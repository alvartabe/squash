import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { MembershipRequest, PaginatedData } from '@squash/contracts';
import { MembershipRequestsSection } from './membership-requests-section';

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

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/src/hooks/membership-requests', () => ({
  membershipRequestErrorCode: (error: { response?: { data?: { error?: { code?: string } } } }) =>
    error.response?.data?.error?.code,
  useApproveMembershipRequest: jest.fn(),
  usePendingMembershipRequests: jest.fn(),
  useRejectMembershipRequest: jest.fn(),
}));

const membershipRequestHooks = jest.requireMock('@/src/hooks/membership-requests') as {
  useApproveMembershipRequest: jest.Mock;
  usePendingMembershipRequests: jest.Mock;
  useRejectMembershipRequest: jest.Mock;
};
const { toast } = jest.requireMock('sonner') as {
  toast: {
    error: jest.Mock;
    success: jest.Mock;
  };
};

const clubId = 'bd8749bd-8b32-4fd2-a96e-5413de2057cc';
const requests = [
  {
    id: '00523eac-aa46-4a1d-ab65-c27366d62572',
    clubId,
    playerId: 'player-with-avatar',
    playerName: 'Ana Vargas',
    playerImage: 'https://example.com/ana.jpg',
    status: 'pending',
    submittedAt: '2026-07-04T15:30:00.000Z',
    resolvedAt: null,
    resolvedById: null,
  },
  {
    id: 'a8e4f28f-9611-4510-8805-b58e80727b68',
    clubId,
    playerId: 'player-with-fallback',
    playerName: 'Bruno Navarro',
    playerImage: null,
    status: 'pending',
    submittedAt: '2026-07-03T16:00:00.000Z',
    resolvedAt: null,
    resolvedById: null,
  },
] satisfies [MembershipRequest, MembershipRequest];

function page(
  items: MembershipRequest[] = requests,
  totalPages = 1,
): PaginatedData<MembershipRequest> {
  return {
    items,
    page: 0,
    pageSize: 15,
    total: items.length,
    totalPages,
  };
}

function queryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: page(),
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: jest.fn(),
    ...overrides,
  };
}

describe('MembershipRequestsSection', () => {
  let currentQuery: ReturnType<typeof queryResult>;
  let approve: { isPending: boolean; mutateAsync: jest.Mock };
  let reject: { isPending: boolean; mutateAsync: jest.Mock };

  beforeEach(() => {
    currentQuery = queryResult();
    approve = { isPending: false, mutateAsync: jest.fn().mockResolvedValue(undefined) };
    reject = { isPending: false, mutateAsync: jest.fn().mockResolvedValue(undefined) };
    membershipRequestHooks.usePendingMembershipRequests.mockImplementation(() => currentQuery);
    membershipRequestHooks.useApproveMembershipRequest.mockImplementation(() => approve);
    membershipRequestHooks.useRejectMembershipRequest.mockImplementation(() => reject);
    toast.error.mockReset();
    toast.success.mockReset();
  });

  it('renders Player identity, avatar or fallback, submission date, and Pending status without email', () => {
    const requestWithPrivateEmail = {
      ...requests[0],
      email: 'ana.private@example.com',
    };
    currentQuery = queryResult({ data: page([requestWithPrivateEmail, requests[1]]) });

    render(<MembershipRequestsSection clubId={clubId} archived={false} />);

    expect(screen.getByText('Ana Vargas')).toBeInTheDocument();
    expect(screen.getByText('Bruno Navarro')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/ana.jpg');
    expect(screen.getByText('BN')).toBeInTheDocument();
    expect(screen.getByText(/Jul 4, 2026/)).toBeInTheDocument();
    expect(screen.getAllByText('Pending')).toHaveLength(2);
    expect(screen.queryByText('ana.private@example.com')).not.toBeInTheDocument();
  });

  it('requires confirmation before approving and rejecting, then reports successful actions', async () => {
    render(<MembershipRequestsSection clubId={clubId} archived={false} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]!);
    expect(approve.mutateAsync).not.toHaveBeenCalled();
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Approve this Membership Request?')).toBeInTheDocument();
    expect(within(dialog).getByText(/Ana Vargas/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(approve.mutateAsync).toHaveBeenCalledWith('00523eac-aa46-4a1d-ab65-c27366d62572'),
    );
    expect(toast.success).toHaveBeenCalledWith('Membership Request approved.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Reject' })[0]!);
    expect(reject.mutateAsync).not.toHaveBeenCalled();
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Reject this Membership Request?')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() =>
      expect(reject.mutateAsync).toHaveBeenCalledWith('00523eac-aa46-4a1d-ab65-c27366d62572'),
    );
    expect(toast.success).toHaveBeenCalledWith('Membership Request rejected.');
  });

  it('reports a stale request with the specific refreshed-queue message', async () => {
    approve.mutateAsync.mockRejectedValue({
      response: { data: { error: { code: 'MEMBERSHIP_REQUEST_NOT_PENDING' } } },
    });
    render(<MembershipRequestsSection clubId={clubId} archived={false} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]!);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'This Membership Request is no longer Pending. The queue has been refreshed.',
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('disables approval and rejection for an archived Club', () => {
    render(<MembershipRequestsSection clubId={clubId} archived />);

    expect(
      screen.getByText(
        'This Club is archived. Pending Membership Requests cannot be approved or rejected.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Approve' })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Reject' })[0]).toBeDisabled();
  });

  it('searches from the first page and displays the search empty state', () => {
    currentQuery = queryResult({ data: page([]) });
    render(<MembershipRequestsSection clubId={clubId} archived={false} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search Pending Membership Requests' }), {
      target: { value: 'maria' },
    });

    expect(membershipRequestHooks.usePendingMembershipRequests).toHaveBeenLastCalledWith(
      clubId,
      { page: 0, pageSize: 15, search: 'maria' },
      true,
    );
    expect(
      screen.getByText('No Pending Membership Requests match your search.'),
    ).toBeInTheDocument();
  });

  it('renders empty, loading, and retryable error states', () => {
    currentQuery = queryResult({ data: page([]) });
    const view = render(<MembershipRequestsSection clubId={clubId} archived={false} />);
    expect(screen.getByText('There are no Pending Membership Requests.')).toBeInTheDocument();

    currentQuery = queryResult({ data: undefined, isLoading: true });
    view.rerender(<MembershipRequestsSection clubId={clubId} archived={false} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    const refetch = jest.fn();
    currentQuery = queryResult({ data: undefined, isError: true, refetch });
    view.rerender(<MembershipRequestsSection clubId={clubId} archived={false} />);
    expect(
      screen.getByText(
        'Pending Membership Requests could not be loaded. Check your connection and try again.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('moves between available pages and disables unavailable directions', () => {
    currentQuery = queryResult({ data: page(requests, 3) });
    render(<MembershipRequestsSection clubId={clubId} archived={false} />);

    const previous = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    fireEvent.click(next);
    expect(membershipRequestHooks.usePendingMembershipRequests).toHaveBeenLastCalledWith(
      clubId,
      { page: 1, pageSize: 15, search: '' },
      true,
    );
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });
});
