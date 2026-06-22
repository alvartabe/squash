'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

export function TurnstileWidget({
  siteKey,
  onChange,
}: {
  siteKey: string;
  onChange: (token: string | null) => void;
}) {
  const [ready, setReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const markReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    if ((window as unknown as { turnstile?: TurnstileApi }).turnstile) setReady(true);
  }, []);
  useEffect(() => {
    const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (!ready || !api || !container.current || widgetId.current) return;
    widgetId.current = api.render(container.current, {
      sitekey: siteKey,
      size: 'flexible',
      callback: (token: string) => onChange(token),
      'expired-callback': () => onChange(null),
      'error-callback': () => onChange(null),
    });
    return () => {
      if (widgetId.current) api.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [onChange, ready, siteKey]);
  if (!siteKey) return null;
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={markReady}
        onReady={markReady}
      />
      <div ref={container} />
    </div>
  );
}
