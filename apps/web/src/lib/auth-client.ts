import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields, twoFactorClient } from 'better-auth/client/plugins';
import type { auth, managementAuth } from '@squash/server/auth';

export const playerAuthClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const managementAuthClient = createAuthClient({
  basePath: '/api/management-auth',
  plugins: [
    inferAdditionalFields<typeof managementAuth>(),
    twoFactorClient({ twoFactorPage: '/two-factor' }),
  ],
});

export const authClient = playerAuthClient;
