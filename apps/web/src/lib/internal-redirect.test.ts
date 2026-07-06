import {
  authenticationBoundaryForCallback,
  internalCallbackPath,
} from '@/src/lib/internal-redirect';

describe('internal authentication redirects', () => {
  it('uses Player authentication only for the web Club Invitation journey', () => {
    expect(authenticationBoundaryForCallback('/club-invitations/token-123')).toBe('player');
    expect(authenticationBoundaryForCallback('/workspace')).toBe('management');
    expect(authenticationBoundaryForCallback('/security')).toBe('management');
  });

  it('rejects external callback destinations before selecting an authentication boundary', () => {
    const callback = internalCallbackPath('//attacker.example/club-invitations/token-123');
    expect(callback).toBe('/workspace');
    expect(authenticationBoundaryForCallback(callback)).toBe('management');
  });
});
