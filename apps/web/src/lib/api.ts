import Axios from 'axios';
import { squashApi } from '@squash/api-client';

export const api = Axios.create({
  baseURL: '/api/v1',
  timeout: 15_000,
  withCredentials: true,
});

export const membershipRequestApi = squashApi(api);

api.interceptors.request.use((config) => {
  config.headers.set('X-Time-Zone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  config.headers.set('Accept-Language', document.documentElement.lang || 'en-US');
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const code = (error as { response?: { data?: { error?: { code?: string } } } }).response?.data
      ?.error?.code;
    if (typeof window !== 'undefined') {
      if (code === 'MANAGEMENT_CREDENTIAL_REQUIRED' || code === 'MFA_ENROLLMENT_REQUIRED') {
        window.location.assign('/security');
      }
      if (code === 'MFA_VERIFICATION_REQUIRED') {
        const callbackURL = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/login?callbackURL=${encodeURIComponent(callbackURL)}`);
      }
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(error: unknown, fallback: string) {
  const key = (error as { response?: { data?: { error?: { messageKey?: string } } } })?.response
    ?.data?.error?.messageKey;
  return key ?? fallback;
}
