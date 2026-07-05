import { createApiClient, squashApi } from '@squash/api-client';
import { authClient } from './auth-client';
import { mobileLocale } from './i18n';

export const apiClient = createApiClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  getLocale: () => mobileLocale,
  getTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  getAuthCookie: () => authClient.getCookie(),
});

export const api = squashApi(apiClient);
