import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Username discovery migration', () => {
  const migration = readFileSync(
    resolve(process.cwd(), '../db/migrations/0014_sweet_mysterio.sql'),
    'utf8',
  );

  it('adds exact-text Username uniqueness and the Junior exclusion marker', () => {
    expect(migration).toContain('ADD COLUMN "username" text');
    expect(migration).toContain('"is_junior" boolean DEFAULT false NOT NULL');
    expect(migration).toContain('CREATE UNIQUE INDEX "player_profiles_username_unique"');
    expect(migration).not.toMatch(/lower\s*\(/i);
  });
});
