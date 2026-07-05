import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { ClubLifecycleActions, clubLifecycleVisibility } from './club-lifecycle-actions';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const archiveMutation = {
  isPending: false,
  mutateAsync: jest.fn<Promise<unknown>, []>(),
};
const restoreMutation = {
  isPending: false,
  mutateAsync: jest.fn<Promise<unknown>, []>(),
};

jest.mock('@/src/hooks/workspace', () => ({
  useArchiveClub: () => archiveMutation,
  useRestoreClub: () => restoreMutation,
}));

let locale: 'en-US' | 'es-419' = 'en-US';
jest.mock('@/src/locale-provider', () => {
  const { translate } = jest.requireActual('@squash/i18n') as typeof import('@squash/i18n');
  return {
    useLocale: () => ({
      locale,
      t: (key: Parameters<typeof translate>[1]) => translate(locale, key),
    }),
  };
});

const baseProps = {
  clubId: 'bd8749bd-8b32-4fd2-a96e-5413de2057cc',
  archived: false,
  canArchive: true,
  canRestore: false,
};

describe('Club lifecycle management actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    locale = 'en-US';
    archiveMutation.isPending = false;
    restoreMutation.isPending = false;
    archiveMutation.mutateAsync.mockResolvedValue({});
    restoreMutation.mutateAsync.mockResolvedValue({});
  });

  it.each([
    ['active Owner', null, 'active', ['owner'], false, true, false],
    ['Club Administrator', null, 'active', ['admin'], false, false, false],
    ['Coach', null, 'active', ['coach'], false, false, false],
    ['ordinary Player', null, 'active', [], false, false, false],
    ['suspended Owner', null, 'suspended', ['owner'], false, false, false],
    ['ended Owner', null, 'ended', ['owner'], false, false, false],
    ['Platform Administrator', null, null, [], true, false, false],
    ['archived active Owner', '2026-07-04T12:00:00.000Z', 'active', ['owner'], false, false, true],
    ['archived Platform Administrator', '2026-07-04T12:00:00.000Z', null, [], true, false, true],
  ] as const)(
    'derives lifecycle action visibility for an %s',
    (
      _label,
      archivedAt,
      membershipStatus,
      responsibilities,
      platformAdmin,
      canArchive,
      canRestore,
    ) => {
      expect(
        clubLifecycleVisibility({
          archivedAt,
          membershipStatus,
          responsibilities,
          platformAdmin,
        }),
      ).toEqual({ canArchive, canRestore });
    },
  );

  it('shows archive only when an active Club Owner is eligible', () => {
    const { rerender } = render(<ClubLifecycleActions {...baseProps} canArchive={false} />);
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();

    rerender(<ClubLifecycleActions {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
  });

  it('shows restore to an eligible Owner or Platform Administrator for an archived Club', () => {
    render(<ClubLifecycleActions {...baseProps} archived canArchive={false} canRestore />);
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
  });

  it('requires confirmation and explains that the cascade is not reversed', () => {
    render(<ClubLifecycleActions {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    expect(screen.getByRole('heading', { name: 'Archive this club?' })).toBeInTheDocument();
    expect(screen.getByText(/Pending Membership Request/)).toBeInTheDocument();
    expect(
      screen.getByText(/Restoring the Club will not reverse these changes/),
    ).toBeInTheDocument();
    expect(archiveMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('disables duplicate submissions while archival is pending', () => {
    const { rerender } = render(<ClubLifecycleActions {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    archiveMutation.isPending = true;
    rerender(<ClubLifecycleActions {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Archiving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('submits archival only once when confirmation is activated repeatedly', async () => {
    let finish: (() => void) | undefined;
    archiveMutation.mutateAsync.mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({});
      }),
    );
    render(<ClubLifecycleActions {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    const confirm = screen.getAllByRole('button', { name: 'Archive' }).at(-1)!;

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(archiveMutation.mutateAsync).toHaveBeenCalledTimes(1);
    finish?.();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Club archived.'));
  });

  it('shows localized success feedback and closes after success', async () => {
    render(<ClubLifecycleActions {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' }).at(-1)!);

    await waitFor(() => expect(archiveMutation.mutateAsync).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith('Club archived.');
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Archive this club?' })).not.toBeInTheDocument(),
    );
  });

  it('keeps confirmation open and explains an active-Tournament failure', async () => {
    archiveMutation.mutateAsync.mockRejectedValue({
      response: {
        data: { error: { code: 'CLUB_ARCHIVE_ACTIVE_TOURNAMENT' } },
      },
    });
    render(<ClubLifecycleActions {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' }).at(-1)!);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'The Club cannot be archived while an Official Tournament is in Group Stage or Knockout Stage.',
      ),
    );
    expect(screen.getByRole('heading', { name: 'Archive this club?' })).toBeInTheDocument();
  });

  it.each([
    ['en-US', 'Restore this club?', 'Club restored.'],
    ['es-419', '¿Restaurar este club?', 'Club restaurado.'],
  ] as const)(
    'covers restore confirmation and feedback in %s',
    async (nextLocale, title, message) => {
      locale = nextLocale;
      render(<ClubLifecycleActions {...baseProps} archived canArchive={false} canRestore />);
      fireEvent.click(
        screen.getByRole('button', { name: nextLocale === 'en-US' ? 'Restore' : 'Restaurar' }),
      );
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      fireEvent.click(
        screen
          .getAllByRole('button', { name: nextLocale === 'en-US' ? 'Restore' : 'Restaurar' })
          .at(-1)!,
      );

      await waitFor(() => expect(restoreMutation.mutateAsync).toHaveBeenCalledTimes(1));
      expect(toast.success).toHaveBeenCalledWith(message);
    },
  );
});
