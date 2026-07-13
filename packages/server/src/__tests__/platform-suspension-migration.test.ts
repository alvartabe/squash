import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(process.cwd(), '../db/migrations/0015_minor_ted_forrester.sql');
const snapshotPath = resolve(process.cwd(), '../db/migrations/meta/0015_snapshot.json');
const journalPath = resolve(process.cwd(), '../db/migrations/meta/_journal.json');

describe('Platform Suspension migration', () => {
  it('adds a dedicated nullable account-level timestamp without changing Membership Status', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain(
      'ALTER TABLE "users" ADD COLUMN "platform_suspended_at" timestamp with time zone',
    );
    expect(migration).not.toContain('membership_status');
    expect(migration).not.toContain('club_memberships');
    expect(migration).toContain('CREATE TRIGGER "sessions_platform_account_access"');
    expect(migration).toContain('CREATE TRIGGER "management_sessions_platform_account_access"');
    expect(migration).toContain('FOR SHARE');
  });

  it('keeps the generated schema snapshot and migration journal consistent', () => {
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as {
      tables: Record<string, { columns: Record<string, { type: string; notNull: boolean }> }>;
    };
    expect(snapshot.tables['public.users']?.columns.platform_suspended_at).toMatchObject({
      type: 'timestamp with time zone',
      notNull: false,
    });
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    expect(journal.entries.at(-1)).toMatchObject({
      idx: 15,
      tag: '0015_minor_ted_forrester',
    });
  });
});
