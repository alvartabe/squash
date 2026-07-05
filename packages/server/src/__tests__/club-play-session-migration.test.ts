import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Club Play Session migration', () => {
  const migration = readFileSync(
    resolve(process.cwd(), '../db/migrations/0007_equal_dragon_lord.sql'),
    'utf8',
  );

  it('renames the legacy tables instead of creating a parallel Session model', () => {
    expect(migration).toContain('ALTER TABLE "open_play_sessions" RENAME TO "club_play_sessions"');
    expect(migration).toContain(
      'ALTER TABLE "open_play_attendees" RENAME TO "club_play_session_participants"',
    );
  });

  it('maps legacy attendance safely into Going, Not going, or No response', () => {
    expect(migration).toContain("WHEN 'accepted' THEN 'going'");
    expect(migration).toContain("WHEN 'declined' THEN 'not-going'");
    expect(migration).toContain('ELSE NULL');
    expect(migration).toContain('ALTER COLUMN "response" DROP NOT NULL');
  });

  it('removes score linkage from Club Play Sessions', () => {
    expect(migration).toContain(`DELETE FROM "matches" WHERE "source" = 'open-play'`);
    expect(migration).toContain('DROP TABLE "open_play_matches" CASCADE');
    expect(migration.indexOf(`DELETE FROM "matches" WHERE "source" = 'open-play'`)).toBeLessThan(
      migration.indexOf('DROP TABLE "open_play_matches" CASCADE'),
    );
  });

  it('removes the legacy open-play Match source after deleting its records', () => {
    expect(migration).toContain(
      `CREATE TYPE "public"."match_source" AS ENUM('challenge', 'tournament')`,
    );
    expect(migration).toContain('DROP TYPE "public"."match_source_old"');
  });
});
