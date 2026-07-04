import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Club Membership migration', () => {
  const migration = readFileSync(
    resolve(process.cwd(), '../db/migrations/0004_clear_toad_men.sql'),
    'utf8',
  );

  it('backfills existing responsibilities before dropping the legacy role', () => {
    const backfill = migration.indexOf('INSERT INTO "club_responsibilities"');
    const dropLegacyRole = migration.indexOf('DROP COLUMN "role"');

    expect(backfill).toBeGreaterThan(-1);
    expect(dropLegacyRole).toBeGreaterThan(backfill);
    expect(migration).toContain(`WHERE "role" IN ('owner', 'admin', 'coach')`);
  });

  it('enforces one Owner responsibility per Club', () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "club_responsibilities_one_owner_idx"');
    expect(migration).toContain(`WHERE "club_responsibilities"."responsibility" = 'owner'`);
  });

  it('migrates invitation responsibilities before dropping the legacy role enum', () => {
    const invitationBackfill = migration.indexOf('UPDATE "club_invitations"');
    const dropInvitationRole = migration.indexOf(
      'ALTER TABLE "club_invitations" DROP COLUMN "role"',
    );
    const dropRoleEnum = migration.indexOf('DROP TYPE "public"."club_role"');

    expect(invitationBackfill).toBeGreaterThan(-1);
    expect(dropInvitationRole).toBeGreaterThan(invitationBackfill);
    expect(dropRoleEnum).toBeGreaterThan(dropInvitationRole);
  });
});
