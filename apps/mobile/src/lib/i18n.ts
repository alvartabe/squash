import { resolveLocale, translate, type MessageKey } from '@squash/i18n';

export const mobileLocale = resolveLocale(Intl.DateTimeFormat().resolvedOptions().locale);
export const t = (key: MessageKey) => translate(mobileLocale, key);
