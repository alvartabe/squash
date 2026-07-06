import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Better Auth MFA migration', () => {
  const migration = readFileSync(
    resolve(process.cwd(), '../db/migrations/0008_many_gauntlet.sql'),
    'utf8',
  );

  it('adds the installed Better Auth 1.6.20 two-factor schema', () => {
    expect(migration).toContain('ALTER TABLE "users" ADD COLUMN "two_factor_enabled"');
    expect(migration).toContain('CREATE TABLE "two_factor"');
    expect(migration).toContain('"secret" text NOT NULL');
    expect(migration).toContain('"backup_codes" text NOT NULL');
    expect(migration).toContain('"verified" boolean DEFAULT true');
    expect(migration).toContain('two_factor_user_id_users_id_fk');
    expect(migration).toContain('CREATE INDEX "two_factor_secret_idx"');
    expect(migration).toContain('CREATE INDEX "two_factor_user_id_idx"');
  });

  it('isolates management sessions in a separate foreign-keyed table', () => {
    expect(migration).toContain('CREATE TABLE "management_sessions"');
    expect(migration).toContain('CONSTRAINT "management_sessions_token_unique"');
    expect(migration).toContain('management_sessions_user_id_users_id_fk');
    expect(migration).toContain('CREATE INDEX "management_sessions_user_idx"');
  });
});
