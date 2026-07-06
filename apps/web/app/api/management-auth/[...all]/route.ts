import { managementAuth } from '@squash/server/auth';
import { toNextJsHandler } from 'better-auth/next-js';
import { NextResponse } from 'next/server';

const handlers = toNextJsHandler(managementAuth);

const allowedPaths = new Set([
  '/get-session',
  '/request-password-reset',
  '/reset-password',
  '/send-verification-email',
  '/sign-in/email',
  '/sign-out',
  '/two-factor/disable',
  '/two-factor/enable',
  '/two-factor/generate-backup-codes',
  '/two-factor/get-totp-uri',
  '/two-factor/verify-backup-code',
  '/two-factor/verify-totp',
  '/verify-email',
]);

function managementAuthPath(request: Request) {
  return new URL(request.url).pathname.replace(/^\/api\/management-auth/, '') || '/';
}

function rejectUnavailableEndpoint() {
  return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
}

export function GET(request: Request) {
  if (!allowedPaths.has(managementAuthPath(request))) return rejectUnavailableEndpoint();
  return handlers.GET(request);
}

export function POST(request: Request) {
  if (!allowedPaths.has(managementAuthPath(request))) return rejectUnavailableEndpoint();
  return handlers.POST(request);
}
