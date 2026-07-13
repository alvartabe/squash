import { auth, managementAuth } from '@squash/server/auth';
import {
  requireActivePlatformAccount,
  requireManagementAuthentication,
  ServiceError,
} from '@squash/server';
import { isAPIError } from 'better-auth/api';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new ServiceError('UNAUTHORIZED', 'error.unauthorized', 401);
  await requireActivePlatformAccount(session.user.id);
  return session.user.id;
}

export async function requireManagementUserId(): Promise<string> {
  const requestHeaders = await headers();
  const managementSession = await managementAuth.api.getSession({ headers: requestHeaders });
  const playerSession = managementSession
    ? null
    : await auth.api.getSession({ headers: requestHeaders });
  const state = await requireManagementAuthentication(
    managementSession?.user.id ?? null,
    playerSession?.user.id ?? null,
  );
  return state.userId;
}

type AuthenticatedRouteHandler<Context> = (
  actorId: string,
  request: Request,
  context: Context,
) => Promise<Response>;

function authenticatedRoute<Context>(
  authenticate: () => Promise<string>,
  handler: AuthenticatedRouteHandler<Context>,
) {
  return async (request: Request, context: Context) => {
    try {
      return await handler(await authenticate(), request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function managementRoute<Context>(handler: AuthenticatedRouteHandler<Context>) {
  return authenticatedRoute(requireManagementUserId, handler);
}

export function playerRoute<Context>(handler: AuthenticatedRouteHandler<Context>) {
  return authenticatedRoute(requireUserId, handler);
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
  if (isAPIError(error)) {
    return NextResponse.json(
      {
        error: {
          code: error.body?.code ?? 'AUTHENTICATION_ERROR',
          messageKey: 'error.invalidRequest',
          requestId,
        },
      },
      { status: error.statusCode },
    );
  }
  console.error({ requestId, error });
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', messageKey: 'error.internal', requestId } },
    { status: 500 },
  );
}
