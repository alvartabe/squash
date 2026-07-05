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

export function apiErrorMessage(error: unknown, fallback: string) {
  const key = (error as { response?: { data?: { error?: { messageKey?: string } } } })?.response
    ?.data?.error?.messageKey;
  return key ?? fallback;
}
