import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createAuditIndexService } from '../audit-index';

function auditId(value: number) {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`;
}

test('audit cursor pagination is deterministic and neither skips nor duplicates equal timestamps', async () => {
  const client = new PGlite();
  try {
    await client.exec(`
      CREATE TABLE audit_logs (
        id uuid PRIMARY KEY,
        actor_id text,
        club_id uuid,
        action text NOT NULL,
        entity_type text NOT NULL,
        entity_id text NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL
      );
    `);

    const expectedIds: string[] = [];
    for (let value = 49; value >= 1; value -= 1) {
      const id = auditId(value);
      expectedIds.push(id);
      await client.query(
        `INSERT INTO audit_logs
          (id, actor_id, club_id, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)`,
        [
          id,
          value === 1 ? null : `actor-${value}`,
          'official-result.corrected',
          'match',
          `match-${value}`,
          JSON.stringify({ private: `secret-${value}` }),
          '2026-07-12 15:00:01.000000+00',
        ],
      );
    }

    for (let value = 53; value >= 50; value -= 1) {
      const id = auditId(value);
      expectedIds.push(id);
      await client.query(
        `INSERT INTO audit_logs
          (id, actor_id, club_id, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, NULL, NULL, 'club.archived', 'club', $2, '{}', $3)`,
        [id, `club-${value}`, '2026-07-12 15:00:00.000900+00'],
      );
    }

    const finalId = auditId(54);
    expectedIds.push(finalId);
    await client.query(
      `INSERT INTO audit_logs
        (id, actor_id, club_id, action, entity_type, entity_id, metadata, created_at)
       VALUES ($1, NULL, NULL, 'club.created', 'club', 'club-54', '{}', $2)`,
      [finalId, '2026-07-12 15:00:00.000100+00'],
    );

    const service = createAuditIndexService(
      drizzle(client) as unknown as Parameters<typeof createAuditIndexService>[0],
      async () => undefined,
    );
    const firstPage = await service.listPlatformAuditRecords('platform-admin-id');
    assert.equal(firstPage.items.length, 50);
    assert.ok(firstPage.nextCursor);
    assert.deepEqual(
      firstPage.items.map((record) => record.id),
      expectedIds.slice(0, 50),
    );

    const secondPage = await service.listPlatformAuditRecords('platform-admin-id', {
      cursor: firstPage.nextCursor,
    });
    assert.equal(secondPage.nextCursor, null);
    assert.deepEqual(
      secondPage.items.map((record) => record.id),
      expectedIds.slice(50),
    );
    assert.deepEqual(
      [...firstPage.items, ...secondPage.items].map((record) => record.id),
      expectedIds,
    );
    assert.equal(new Set(expectedIds).size, expectedIds.length);
    assert.equal('metadata' in firstPage.items[0]!, false);
  } finally {
    await client.close();
  }
});
