import Link from 'next/link';
import { translate } from '@squash/i18n';

export default function HomePage() {
  const t = (key: Parameters<typeof translate>[1]) => translate('en-US', key);
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-6 px-8">
      <span className="w-fit rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">
        {t('web.badge')}
      </span>
      <h1 className="max-w-3xl text-5xl font-bold tracking-tight">{t('web.heading')}</h1>
      <p className="max-w-2xl text-lg text-muted">{t('web.description')}</p>
      <Link className="w-fit rounded-lg bg-brand px-5 py-3 font-semibold text-white" href="/admin">
        {t('web.openAdmin')}
      </Link>
    </main>
  );
}
