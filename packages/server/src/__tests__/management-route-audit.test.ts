import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const webRoot = resolve(process.cwd(), '../../apps/web/app/api/v1');

function route(path: string) {
  return readFileSync(resolve(webRoot, path), 'utf8');
}

describe('web-management API authentication audit', () => {
  it('keeps Player/OAuth authentication separate from credential-only management auth', () => {
    const authSource = readFileSync(resolve(process.cwd(), 'src/auth.ts'), 'utf8');
    const playerAuth = authSource.slice(
      authSource.indexOf('export const auth'),
      authSource.indexOf('export const managementAuth'),
    );
    const managementAuth = authSource.slice(authSource.indexOf('export const managementAuth'));
    const webLogin = readFileSync(
      resolve(process.cwd(), '../../apps/web/components/auth/auth-card.tsx'),
      'utf8',
    );
    const onboardingLogin = readFileSync(
      resolve(process.cwd(), '../../apps/web/components/auth/security-onboarding-login.tsx'),
      'utf8',
    );
    const mobileClient = readFileSync(
      resolve(process.cwd(), '../../apps/mobile/src/lib/auth-client.ts'),
      'utf8',
    );

    expect(playerAuth).toContain('socialProviders');
    expect(playerAuth).not.toContain('twoFactor({');
    expect(managementAuth).toContain("session: { modelName: 'managementSession' }");
    expect(managementAuth).toContain("cookiePrefix: 'squash-management'");
    expect(managementAuth).toContain('twoFactor({');
    expect(managementAuth).not.toContain('socialProviders');
    expect(authSource).toContain('revokeSessionsOnPasswordReset: true');
    expect(authSource).toContain('onPasswordReset');
    expect(authSource).toContain("context.path === '/two-factor/disable'");
    expect(authSource).toContain('revokeManagementSecurityArtifacts');
    expect(webLogin).not.toContain('signIn.social');
    expect(onboardingLogin).toContain('playerAuthClient.signIn.social');
    expect(onboardingLogin).toContain("callbackURL: '/security'");
    expect(mobileClient).not.toContain('twoFactorClient');
  });

  it('uses the Player authentication boundary for web Club Invitation acceptance', () => {
    const loginPage = readFileSync(
      resolve(process.cwd(), '../../apps/web/app/(auth)/login/page.tsx'),
      'utf8',
    );
    const authCard = readFileSync(
      resolve(process.cwd(), '../../apps/web/components/auth/auth-card.tsx'),
      'utf8',
    );

    expect(loginPage).toContain('authenticationBoundaryForCallback');
    expect(authCard).toContain("authenticationBoundary === 'management'");
    expect(authCard).toContain('playerAuthClient.signIn.email');
  });

  it.each([
    'clubs/route.ts',
    'clubs/[clubId]/route.ts',
    'clubs/[clubId]/restore/route.ts',
    'clubs/[clubId]/transfer-ownership/route.ts',
    'clubs/[clubId]/invitations/route.ts',
    'clubs/[clubId]/invitations/[invitationId]/resend/route.ts',
    'clubs/[clubId]/invitations/[invitationId]/route.ts',
    'clubs/[clubId]/members/route.ts',
    'clubs/[clubId]/members/[userId]/route.ts',
    'clubs/[clubId]/membership-requests/[requestId]/approve/route.ts',
    'clubs/[clubId]/membership-requests/[requestId]/reject/route.ts',
    'clubs/[clubId]/play-sessions/route.ts',
    'club-play-sessions/[sessionId]/participants/route.ts',
    'tournaments/[tournamentId]/draft-draw/route.ts',
    'tournaments/[tournamentId]/start/route.ts',
    'tournaments/[tournamentId]/open/route.ts',
    'tournaments/[tournamentId]/visibility/route.ts',
    'tournaments/[tournamentId]/management/route.ts',
    'tournaments/[tournamentId]/entry-requests/[requestId]/approve/route.ts',
    'tournaments/[tournamentId]/entry-requests/[requestId]/reject/route.ts',
    'tournaments/[tournamentId]/invitations/route.ts',
    'tournaments/[tournamentId]/participants/route.ts',
    'tournaments/[tournamentId]/participants/[playerId]/route.ts',
    'tournaments/[tournamentId]/player-candidates/route.ts',
    'clubs/[clubId]/tournaments/route.ts',
    'me/route.ts',
  ])('%s uses the centralized management-authentication guard', (path) => {
    const source = route(path);
    expect(source).toContain('requireManagementUserId');
    expect(source).not.toMatch(/await requireUserId\(\)/);
  });

  it('separates Tournament Player discovery from Draft creation in the shared route', () => {
    const source = route('tournaments/route.ts');
    const getHandler = source.slice(
      source.indexOf('export async function GET'),
      source.indexOf('export async function POST'),
    );
    const postHandler = source.slice(source.indexOf('export async function POST'));
    expect(getHandler).toContain('requireUserId');
    expect(getHandler).not.toContain('requireManagementUserId');
    expect(postHandler).toContain('requireManagementUserId');
    expect(postHandler).not.toMatch(/await requireUserId\(\)/);
  });

  it.each([
    'tournaments/[tournamentId]/entry-requests/route.ts',
    'tournaments/[tournamentId]/invitations/[invitationId]/accept/route.ts',
    'tournaments/[tournamentId]/invitations/[invitationId]/reject/route.ts',
    'tournaments/[tournamentId]/participation/route.ts',
  ])('%s uses only the Player authentication boundary', (path) => {
    const source = route(path);
    expect(source).toContain('requireUserId');
    expect(source).not.toContain('requireManagementUserId');
  });

  it('guards only the management operation in the shared Membership Request route', () => {
    const source = route('clubs/[clubId]/membership-requests/route.ts');
    const getHandler = source.slice(
      source.indexOf('export async function GET'),
      source.indexOf('export async function POST'),
    );
    const postHandler = source.slice(source.indexOf('export async function POST'));
    expect(getHandler).toContain('requireManagementUserId');
    expect(postHandler).toContain('requireUserId');
  });

  it('keeps Player detail reads while guarding Session coordination mutations', () => {
    const source = route('club-play-sessions/[sessionId]/route.ts');
    const getHandler = source.slice(
      source.indexOf('export async function GET'),
      source.indexOf('export async function PATCH'),
    );
    const patchHandler = source.slice(
      source.indexOf('export async function PATCH'),
      source.indexOf('export async function DELETE'),
    );
    const deleteHandler = source.slice(source.indexOf('export async function DELETE'));
    expect(getHandler).toContain('requireUserId');
    expect(patchHandler).toContain('requireManagementUserId');
    expect(deleteHandler).toContain('requireManagementUserId');
  });

  it('guards Club logo uploads while preserving Player media uploads', () => {
    const source = route('media/uploads/route.ts');
    expect(source).toContain("input.purpose === 'club-logo'");
    expect(source).toContain('requireManagementUserId');
    expect(source).toContain('requireUserId');
  });
});
