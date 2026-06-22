import { auditLogs } from '@squash/db/schema';
import { db } from './database';

export type AuditInput = {
  actorId: string;
  clubId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
};

export function writeAudit(input: AuditInput) {
  return db.insert(auditLogs).values({
    actorId: input.actorId,
    clubId: input.clubId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {},
  });
}
