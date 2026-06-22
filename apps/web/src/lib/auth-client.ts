import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import type { auth } from '@squash/server/auth';

export const authClient = createAuthClient({ plugins: [inferAdditionalFields<typeof auth>()] });
