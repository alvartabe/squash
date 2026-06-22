import { NextRequest, NextResponse } from 'next/server';

const guardedAuthPaths = new Set(['/api/auth/sign-in/email', '/api/auth/sign-up/email']);

type TurnstileResponse = { success: boolean };

export const config = {
  matcher: ['/api/auth/sign-in/email', '/api/auth/sign-up/email'],
};

export async function middleware(request: NextRequest) {
  if (request.method !== 'POST' || !guardedAuthPaths.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return NextResponse.next();
  const token = request.headers.get('x-turnstile-token');
  if (!token) {
    return NextResponse.json(
      {
        error: {
          code: 'TURNSTILE_REQUIRED',
          messageKey: 'auth.turnstileRequired',
          requestId: crypto.randomUUID(),
        },
      },
      { status: 400 },
    );
  }
  try {
    const body = new URLSearchParams({ secret, response: token });
    const clientIp =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (clientIp) body.set('remoteip', clientIp);
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    const result = (await response.json()) as TurnstileResponse;
    if (response.ok && result.success) return NextResponse.next();
  } catch {}
  return NextResponse.json(
    {
      error: {
        code: 'TURNSTILE_FAILED',
        messageKey: 'auth.turnstileRequired',
        requestId: crypto.randomUUID(),
      },
    },
    { status: 400 },
  );
}
