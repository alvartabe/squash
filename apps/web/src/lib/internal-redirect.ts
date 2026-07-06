export function internalCallbackPath(value: string | null | undefined, fallback = '/workspace') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }
  try {
    const parsed = new URL(value, 'https://squash.invalid');
    if (parsed.origin !== 'https://squash.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function authenticationBoundaryForCallback(callbackURL: string) {
  return callbackURL.startsWith('/club-invitations/')
    ? ('player' as const)
    : ('management' as const);
}
