import { useMutation } from '@tanstack/react-query';
import { useTournamentAction, workspaceKeys } from './workspace';

const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((options) => options),
  useQuery: jest.fn(),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

jest.mock('@/src/lib/api', () => ({
  api: { request: jest.fn() },
}));

describe('Tournament management mutations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refreshes Club management and Player Tournament queries after success', () => {
    useTournamentAction('club-id');
    const options = (useMutation as jest.Mock).mock.calls[0]?.[0] as {
      onSuccess: () => void;
    };

    options.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(mockInvalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: workspaceKeys.tournaments('club-id'),
    });
    expect(mockInvalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['tournaments'],
    });
  });
});
