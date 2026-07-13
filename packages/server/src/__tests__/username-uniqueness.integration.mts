import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { ServiceError } from '../errors';
import { createPlayerProfileService } from '../player-profile';

test('the database rejects canonically equivalent Usernames and preserves display casing', async () => {
  const client = new PGlite();
  try {
    await client.exec(`
      CREATE TABLE users (
        id text PRIMARY KEY,
        name text NOT NULL,
        image text,
        locale text NOT NULL DEFAULT 'en-US',
        time_zone text NOT NULL DEFAULT 'UTC',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE player_profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        bio text,
        dominant_hand text,
        visibility text NOT NULL DEFAULT 'shared-clubs',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    const migration = await readFile(
      resolve(process.cwd(), '../db/migrations/0014_clammy_shriek.sql'),
      'utf8',
    );
    await client.exec(migration);
    await client.query(
      `INSERT INTO users (id, name) VALUES ('player-one', 'One'), ('player-two', 'Two')`,
    );

    const service = createPlayerProfileService(
      drizzle(client) as unknown as Parameters<typeof createPlayerProfileService>[0],
    );
    const input = {
      name: 'Player',
      visibility: 'private' as const,
      locale: 'en-US' as const,
      timeZone: 'America/Costa_Rica',
    };
    await service.updateProfile('player-one', { ...input, username: 'Straße' });

    await assert.rejects(
      service.updateProfile('player-two', { ...input, username: 'STRASSE' }),
      (error) =>
        error instanceof ServiceError && error.code === 'USERNAME_TAKEN' && error.status === 409,
    );
    const profile = await service.getPlayerProfile('player-one');
    assert.equal(profile.username, 'Straße');
  } finally {
    await client.close();
  }
});
