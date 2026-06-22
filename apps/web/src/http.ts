import { auth } from '@squash/server/auth';
import { ServiceError } from '@squash/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new ServiceError('UNAUTHORIZED', 'error.unauthorized', 401);
  return session.user.id;
}

export function dataResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function errorResponse(error: unknown) {
  const requestId = crypto.randomUUID();
  if (error instanceof ServiceError) {
    return NextResponse.json(
      { error: { code: error.code, messageKey: error.messageKey, requestId } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_REQUEST',
          messageKey: 'error.invalidRequest',
          fieldErrors: error.flatten().fieldErrors,
          requestId,
        },
      },
      { status: 400 },
    );
  }
  console.error({ requestId, error });
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', messageKey: 'error.internal', requestId } },
    { status: 500 },
  );
}
