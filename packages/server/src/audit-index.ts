import {
  auditRecordPageSchema,
  auditRecordSchema,
  idSchema,
  type AuditIndexQuery,
  type AuditRecord,
  type AuditRecordPage,
} from '@squash/contracts';
import { auditLogs } from '@squash/db/schema';
import { and, desc, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requirePlatformAdmin } from './authorization';
import { db } from './database';
import { ServiceError } from './errors';

const AUDIT_PAGE_SIZE = 50;

type AuditIndexDatabase = Pick<typeof db, 'select'>;
type PlatformAdminAuthorization = (actorId: string) => Promise<unknown>;

type AuditRow = {
  id: string;
  actorId: string | null;
  clubId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
  cursorCreatedAt: string;
};

const cursorBoundarySchema = z
  .object({
    version: z.literal(1),
    createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
    id: idSchema,
  })
  .strict();

type CursorBoundary = z.infer<typeof cursorBoundarySchema>;

function invalidCursor(): ServiceError {
  return new ServiceError('INVALID_AUDIT_CURSOR', 'error.invalidAuditCursor', 400);
}

function encodeCursor(row: Pick<AuditRow, 'cursorCreatedAt' | 'id'>): string {
  return Buffer.from(
    JSON.stringify({ version: 1, createdAt: row.cursorCreatedAt, id: row.id }),
    'utf8',
  ).toString('base64url');
}

function decodeCursor(value: string): CursorBoundary {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw invalidCursor();
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.toString('base64url') !== value) throw invalidCursor();
    return cursorBoundarySchema.parse(JSON.parse(bytes.toString('utf8')));
  } catch {
    throw invalidCursor();
  }
}

export function projectAuditRecord(
  row: AuditRow | (AuditRow & Record<string, unknown>),
): AuditRecord {
  return auditRecordSchema.parse({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    action: row.action,
    actorId: row.actorId,
    entityType: row.entityType,
    entityId: row.entityId,
    clubId: row.clubId,
  });
}

const auditIndexColumns = {
  id: auditLogs.id,
  actorId: auditLogs.actorId,
  clubId: auditLogs.clubId,
  action: auditLogs.action,
  entityType: auditLogs.entityType,
  entityId: auditLogs.entityId,
  createdAt: auditLogs.createdAt,
  // Preserve PostgreSQL sub-millisecond precision inside the opaque cursor. The public projection
  // intentionally remains the normal ISO timestamp returned by the database driver.
  cursorCreatedAt: sql<string>`${auditLogs.createdAt}::text`,
};

export function createAuditIndexService(
  database: AuditIndexDatabase,
  authorizePlatformAdmin: PlatformAdminAuthorization = requirePlatformAdmin,
) {
  async function listPlatformAuditRecords(
    actorId: string,
    input: AuditIndexQuery = {},
  ): Promise<AuditRecordPage> {
    await authorizePlatformAdmin(actorId);
    const boundary = input.cursor === undefined ? null : decodeCursor(input.cursor);
    const cursorCondition = boundary
      ? or(
          sql`${auditLogs.createdAt} < ${boundary.createdAt}::timestamptz`,
          and(
            sql`${auditLogs.createdAt} = ${boundary.createdAt}::timestamptz`,
            lt(auditLogs.id, boundary.id),
          ),
        )
      : undefined;
    const rows = (await database
      .select(auditIndexColumns)
      .from(auditLogs)
      .where(cursorCondition)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(AUDIT_PAGE_SIZE + 1)) as AuditRow[];
    const pageRows = rows.slice(0, AUDIT_PAGE_SIZE);

    return auditRecordPageSchema.parse({
      items: pageRows.map(projectAuditRecord),
      nextCursor:
        rows.length > AUDIT_PAGE_SIZE && pageRows.length > 0
          ? encodeCursor(pageRows[pageRows.length - 1]!)
          : null,
    });
  }

  return { listPlatformAuditRecords };
}

export const { listPlatformAuditRecords } = createAuditIndexService(db);
