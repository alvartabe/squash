import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import {
  createPlatformSuspensionService,
  requireActivePlatformAccount,
} from '../platform-suspension';

const actorId = 'platform-admin-id';
const targetId = 'target-player-id';

async function createHarness(
  options: {
    blockSessionDeletion?: boolean;
    blockTrustDeletion?: boolean;
    blockAudit?: boolean;
  } = {},
) {
  const client = new PGlite();
  await client.exec(`
    CREATE TYPE platform_role AS ENUM ('user', 'platform-admin');
    CREATE TABLE users (
      id text PRIMARY KEY,
      role platform_role NOT NULL DEFAULT 'user',
      platform_suspended_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE sessions (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE management_sessions (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE verifications (
      id text PRIMARY KEY,
      identifier text NOT NULL,
      value text NOT NULL
    );
    CREATE TABLE accounts (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id text NOT NULL,
      password text
    );
    CREATE TABLE two_factor (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      secret text NOT NULL,
      backup_codes text NOT NULL
    );
    CREATE TABLE club_memberships (club_id text, user_id text, status text);
    CREATE TABLE club_responsibilities (club_id text, user_id text, responsibility text);
    CREATE TABLE club_play_sessions (id text PRIMARY KEY, coordinator_id text);
    CREATE TABLE tournament_organizers (tournament_id text, user_id text);
    CREATE TABLE tournament_participations (tournament_id text, player_id text, source text);
    CREATE TABLE completed_history (id text PRIMARY KEY, player_id text, result text);
    CREATE TABLE audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id text,
      club_id uuid,
      action text NOT NULL ${options.blockAudit ? "CHECK (action = 'blocked-for-test')" : ''},
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE FUNCTION enforce_platform_account_session_access()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      current_suspension timestamp with time zone;
    BEGIN
      SELECT platform_suspended_at
        INTO current_suspension
        FROM users
        WHERE id = NEW.user_id
        FOR SHARE;
      IF current_suspension IS NOT NULL THEN
        RAISE EXCEPTION 'ACCOUNT_SUSPENDED' USING ERRCODE = 'P0001';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER sessions_platform_account_access
      BEFORE INSERT ON sessions
      FOR EACH ROW EXECUTE FUNCTION enforce_platform_account_session_access();
    CREATE TRIGGER management_sessions_platform_account_access
      BEFORE INSERT ON management_sessions
      FOR EACH ROW EXECUTE FUNCTION enforce_platform_account_session_access();
  `);
  await client.exec(`
    INSERT INTO users (id, role) VALUES
      ('${actorId}', 'platform-admin'),
      ('${targetId}', 'user'),
      ('ordinary-player-id', 'user');
    INSERT INTO users (id, role, platform_suspended_at)
      VALUES ('suspended-admin-id', 'platform-admin', now());
    INSERT INTO sessions (id, user_id) VALUES
      ('target-player-session', '${targetId}'),
      ('actor-player-session', '${actorId}');
    INSERT INTO management_sessions (id, user_id) VALUES
      ('target-management-session', '${targetId}'),
      ('actor-management-session', '${actorId}');
    INSERT INTO verifications (id, identifier, value) VALUES
      ('target-trust', 'trust-device-target', '${targetId}'),
      ('target-recovery', 'reset-password', '${targetId}'),
      ('actor-trust', 'trust-device-actor', '${actorId}');
    INSERT INTO accounts (id, user_id, provider_id, password) VALUES
      ('credential', '${targetId}', 'credential', 'hashed-password'),
      ('google', '${targetId}', 'google', NULL),
      ('apple', '${targetId}', 'apple', NULL);
    INSERT INTO two_factor (id, user_id, secret, backup_codes)
      VALUES ('target-mfa', '${targetId}', 'encrypted-secret', 'encrypted-backup-codes');
    INSERT INTO club_memberships VALUES ('club-id', '${targetId}', 'active');
    INSERT INTO club_responsibilities VALUES ('club-id', '${targetId}', 'owner');
    INSERT INTO club_play_sessions VALUES ('session-id', '${targetId}');
    INSERT INTO tournament_organizers VALUES ('tournament-id', '${targetId}');
    INSERT INTO tournament_participations VALUES ('tournament-id', '${targetId}', 'direct');
    INSERT INTO completed_history VALUES ('result-id', '${targetId}', 'winner');
  `);
  if (options.blockSessionDeletion) {
    await client.exec(`
      CREATE TABLE session_delete_blockers (
        session_id text PRIMARY KEY REFERENCES sessions(id) ON DELETE RESTRICT
      );
      INSERT INTO session_delete_blockers VALUES ('target-player-session');
    `);
  }
  if (options.blockTrustDeletion) {
    await client.exec(`
      CREATE TABLE verification_delete_blockers (
        verification_id text PRIMARY KEY REFERENCES verifications(id) ON DELETE RESTRICT
      );
      INSERT INTO verification_delete_blockers VALUES ('target-trust');
    `);
  }
  const database = drizzle(client);
  return {
    client,
    database,
    service: createPlatformSuspensionService(database as never),
  };
}

async function count(client: PGlite, table: string, where = '') {
  const result = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM ${table} ${where}`,
  );
  return result.rows[0]?.count ?? 0;
}

test('the Platform Suspension migration applies to the preceding empty users schema', async () => {
  const client = new PGlite();
  try {
    await client.exec(`
      CREATE TABLE users (id text PRIMARY KEY);
      CREATE TABLE sessions (id text PRIMARY KEY, user_id text NOT NULL);
      CREATE TABLE management_sessions (id text PRIMARY KEY, user_id text NOT NULL);
    `);
    await client.exec(
      await readFile(
        resolve(process.cwd(), '../db/migrations/0015_minor_ted_forrester.sql'),
        'utf8',
      ),
    );
    const result = await client.query<{ dataType: string; isNullable: string }>(`
      SELECT data_type AS "dataType", is_nullable AS "isNullable"
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'platform_suspended_at'
    `);
    assert.deepEqual(result.rows[0], {
      dataType: 'timestamp with time zone',
      isNullable: 'YES',
    });
    await client.exec(`
      INSERT INTO users (id, platform_suspended_at) VALUES ('suspended-player', now());
    `);
    await assert.rejects(
      client.query(`INSERT INTO sessions (id, user_id) VALUES ('session-id', 'suspended-player')`),
      /ACCOUNT_SUSPENDED/,
    );
    await assert.rejects(
      client.query(
        `INSERT INTO management_sessions (id, user_id)
         VALUES ('management-session-id', 'suspended-player')`,
      ),
      /ACCOUNT_SUSPENDED/,
    );
  } finally {
    await client.close();
  }
});

test('racing suspension requests create one transition, revoke access, and preserve account data and relationships', async () => {
  const harness = await createHarness();
  try {
    const results = await Promise.all([
      harness.service.suspendPlayer(actorId, targetId),
      harness.service.suspendPlayer(actorId, targetId),
    ]);
    assert.deepEqual(results.map((result) => result.transitioned).sort(), [false, true]);
    assert.equal(results[0]?.state, 'suspended');
    assert.equal(results[1]?.state, 'suspended');
    assert.equal(await count(harness.client, 'audit_logs'), 1);
    const audit = await harness.client.query<{
      action: string;
      actorId: string;
      entityId: string;
      transition: string;
    }>(`
      SELECT action, actor_id AS "actorId", entity_id AS "entityId",
        metadata->>'transition' AS transition
      FROM audit_logs
    `);
    assert.deepEqual(audit.rows[0], {
      action: 'platform.account.suspend',
      actorId,
      entityId: targetId,
      transition: 'suspended',
    });

    assert.equal(await count(harness.client, 'sessions', `WHERE user_id = '${targetId}'`), 0);
    assert.equal(
      await count(harness.client, 'management_sessions', `WHERE user_id = '${targetId}'`),
      0,
    );
    assert.equal(
      await count(
        harness.client,
        'verifications',
        `WHERE value = '${targetId}' AND identifier LIKE 'trust-device-%'`,
      ),
      0,
    );
    assert.equal(await count(harness.client, 'verifications', `WHERE id = 'target-recovery'`), 1);
    assert.equal(await count(harness.client, 'sessions', `WHERE user_id = '${actorId}'`), 1);
    assert.equal(await count(harness.client, 'accounts', `WHERE user_id = '${targetId}'`), 3);
    const mfa = await harness.client.query<{ secret: string; backupCodes: string }>(`
      SELECT secret, backup_codes AS "backupCodes" FROM two_factor WHERE user_id = '${targetId}'
    `);
    assert.deepEqual(mfa.rows[0], {
      secret: 'encrypted-secret',
      backupCodes: 'encrypted-backup-codes',
    });
    for (const table of [
      'club_memberships',
      'club_responsibilities',
      'club_play_sessions',
      'tournament_organizers',
      'tournament_participations',
      'completed_history',
    ]) {
      assert.equal(await count(harness.client, table), 1, `${table} must remain unchanged`);
    }

    await assert.rejects(
      requireActivePlatformAccount(targetId, harness.database as never),
      (error: unknown) =>
        (error as { code?: string }).code === 'ACCOUNT_SUSPENDED' &&
        (error as { status?: number }).status === 403,
    );
    await assert.rejects(
      harness.client.query(
        `INSERT INTO sessions (id, user_id) VALUES ('late-player-session', '${targetId}')`,
      ),
      /ACCOUNT_SUSPENDED/,
    );
    await assert.rejects(
      harness.client.query(
        `INSERT INTO management_sessions (id, user_id)
         VALUES ('late-management-session', '${targetId}')`,
      ),
      /ACCOUNT_SUSPENDED/,
    );

    const reactivated = await harness.service.reactivatePlayer(actorId, targetId);
    assert.equal(reactivated.transitioned, true);
    assert.equal(reactivated.state, 'active');
    assert.equal(reactivated.suspendedAt, null);
    await assert.doesNotReject(requireActivePlatformAccount(targetId, harness.database as never));
    assert.equal(await count(harness.client, 'audit_logs'), 2);
    assert.equal(
      await count(harness.client, 'audit_logs', `WHERE action = 'platform.account.reactivate'`),
      1,
    );
    assert.equal(await count(harness.client, 'sessions', `WHERE user_id = '${targetId}'`), 0);
    assert.equal(
      await count(harness.client, 'management_sessions', `WHERE user_id = '${targetId}'`),
      0,
    );
    assert.equal(
      await count(
        harness.client,
        'verifications',
        `WHERE value = '${targetId}' AND identifier LIKE 'trust-device-%'`,
      ),
      0,
    );
    assert.equal((await harness.service.reactivatePlayer(actorId, targetId)).transitioned, false);
    assert.equal(await count(harness.client, 'audit_logs'), 2);
  } finally {
    await harness.client.close();
  }
});

test('missing targets, non-administrators, and suspended administrators cannot transition accounts', async () => {
  const harness = await createHarness();
  try {
    await assert.rejects(
      harness.service.suspendPlayer(actorId, 'missing-player-id'),
      (error: unknown) =>
        (error as { code?: string }).code === 'PLAYER_NOT_FOUND' &&
        (error as { status?: number }).status === 404,
    );
    await assert.rejects(
      harness.service.suspendPlayer('ordinary-player-id', targetId),
      (error: unknown) => (error as { code?: string }).code === 'FORBIDDEN',
    );
    await assert.rejects(
      harness.service.suspendPlayer('suspended-admin-id', targetId),
      (error: unknown) => (error as { code?: string }).code === 'ACCOUNT_SUSPENDED',
    );
    assert.equal(await count(harness.client, 'audit_logs'), 0);
  } finally {
    await harness.client.close();
  }
});

test('a session-revocation failure rolls back the suspension state and audit evidence', async () => {
  const harness = await createHarness({ blockSessionDeletion: true });
  try {
    await assert.rejects(harness.service.suspendPlayer(actorId, targetId));
    assert.equal(
      await count(
        harness.client,
        'users',
        `WHERE id = '${targetId}' AND platform_suspended_at IS NULL`,
      ),
      1,
    );
    assert.equal(await count(harness.client, 'sessions', `WHERE user_id = '${targetId}'`), 1);
    assert.equal(await count(harness.client, 'audit_logs'), 0);
  } finally {
    await harness.client.close();
  }
});

test('a trusted-device revocation failure rolls back state and already-deleted sessions', async () => {
  const harness = await createHarness({ blockTrustDeletion: true });
  try {
    await assert.rejects(harness.service.suspendPlayer(actorId, targetId));
    assert.equal(
      await count(
        harness.client,
        'users',
        `WHERE id = '${targetId}' AND platform_suspended_at IS NULL`,
      ),
      1,
    );
    assert.equal(await count(harness.client, 'sessions', `WHERE user_id = '${targetId}'`), 1);
    assert.equal(
      await count(harness.client, 'management_sessions', `WHERE user_id = '${targetId}'`),
      1,
    );
    assert.equal(await count(harness.client, 'verifications', `WHERE id = 'target-trust'`), 1);
    assert.equal(await count(harness.client, 'audit_logs'), 0);
  } finally {
    await harness.client.close();
  }
});

test('an audit failure rolls back self-suspension, session revocation, and trusted-device revocation', async () => {
  const harness = await createHarness({ blockAudit: true });
  try {
    await assert.rejects(harness.service.suspendPlayer(actorId, actorId));
    assert.equal(
      await count(
        harness.client,
        'users',
        `WHERE id = '${actorId}' AND platform_suspended_at IS NULL`,
      ),
      1,
    );
    assert.equal(await count(harness.client, 'sessions', `WHERE user_id = '${actorId}'`), 1);
    assert.equal(
      await count(harness.client, 'management_sessions', `WHERE user_id = '${actorId}'`),
      1,
    );
    assert.equal(
      await count(
        harness.client,
        'verifications',
        `WHERE value = '${actorId}' AND identifier LIKE 'trust-device-%'`,
      ),
      1,
    );
    assert.equal(await count(harness.client, 'audit_logs'), 0);
  } finally {
    await harness.client.close();
  }
});
