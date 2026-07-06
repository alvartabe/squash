import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TwoFactorChallenge } from './two-factor-challenge';

const verifyTotp = jest.fn();
const verifyBackupCode = jest.fn();
const replace = jest.fn();
const refresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

jest.mock('@/src/lib/auth-client', () => ({
  managementAuthClient: {
    twoFactor: {
      verifyTotp: (...args: unknown[]) => verifyTotp(...args),
      verifyBackupCode: (...args: unknown[]) => verifyBackupCode(...args),
    },
  },
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

describe('TwoFactorChallenge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    verifyTotp.mockResolvedValue({ data: { token: 'management-token' }, error: null });
    verifyBackupCode.mockResolvedValue({ data: { token: 'management-token' }, error: null });
  });

  it('defaults trusted-device selection to off', () => {
    render(<TwoFactorChallenge />);

    expect(
      screen.getByRole('checkbox', { name: /Trust this device for 30 days/i }),
    ).not.toBeChecked();
    expect(screen.getByText('Do not trust shared or public devices.')).toBeInTheDocument();
  });

  it('passes explicit false to TOTP verification and validates the internal callback', async () => {
    sessionStorage.setItem('squash.management.callback', '//attacker.example/path');
    render(<TwoFactorChallenge />);

    fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));

    await waitFor(() =>
      expect(verifyTotp).toHaveBeenCalledWith({ code: '123456', trustDevice: false }),
    );
    expect(replace).toHaveBeenCalledWith('/workspace');
  });

  it('supports single-use backup-code verification with optional device trust', async () => {
    render(<TwoFactorChallenge />);

    fireEvent.click(screen.getByRole('button', { name: 'Backup code' }));
    fireEvent.change(screen.getByLabelText('Backup code'), { target: { value: 'ABCDE-12345' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Trust this device for 30 days/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));

    await waitFor(() =>
      expect(verifyBackupCode).toHaveBeenCalledWith({
        code: 'ABCDE-12345',
        trustDevice: true,
      }),
    );
  });

  it('localizes excessive verification attempts', async () => {
    verifyTotp.mockResolvedValue({
      data: null,
      error: { code: 'RATE_LIMITED', status: 429 },
    });
    render(<TwoFactorChallenge />);

    fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));

    expect(
      await screen.findByText('Too many attempts. Wait briefly, then sign in again.'),
    ).toBeInTheDocument();
  });
});
