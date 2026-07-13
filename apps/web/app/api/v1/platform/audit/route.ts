import { auditIndexQuerySchema } from '@squash/contracts';
import { listPlatformAuditRecords, ServiceError } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const GET = managementRoute(async (actorId: string, request: Request) => {
  const searchParams = new URL(request.url).searchParams;
  const query = auditIndexQuerySchema.safeParse({
    cursor: searchParams.get('cursor') ?? undefined,
  });
  if (!query.success) {
    throw new ServiceError('INVALID_AUDIT_CURSOR', 'error.invalidAuditCursor', 400);
  }
  return dataResponse(await listPlatformAuditRecords(actorId, query.data));
});
