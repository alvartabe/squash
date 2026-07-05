import { resolveLocale, translate, type MessageKey } from '@squash/i18n';

const devicePreferences = Intl.DateTimeFormat().resolvedOptions();

export function resolveMobileLocale(
  locale: string | null | undefined,
  timeZone: string | undefined,
) {
  if (locale?.toLowerCase().startsWith('es')) return 'es-419';
  if (locale?.toLowerCase().startsWith('en')) return 'en-US';
  if (timeZone === 'America/Costa_Rica') return 'es-419';
  return resolveLocale(locale);
}

export const mobileLocale = resolveMobileLocale(
  devicePreferences.locale,
  devicePreferences.timeZone,
);
export const t = (key: MessageKey) => translate(mobileLocale, key);
