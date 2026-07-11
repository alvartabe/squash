import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Official Tournament participation migration', () => {
  const migration = readFileSync(
    resolve(process.cwd(), '../db/migrations/0009_narrow_mephisto.sql'),
    'utf8',
  );

  it('drops the dev-only direct-registration table without carrying a legacy participation source', () => {
    const drop = migration.indexOf('DROP TABLE "tournament_registrations"');
    expect(drop).toBeGreaterThan(-1);
    expect(migration).not.toContain('INSERT INTO "tournament_participations"');
    expect(migration).not.toContain('legacy');
    expect(migration).not.toContain('"registered_at"');
  });

  it('conservatively backfills visibility without defining a schema default', () => {
    expect(migration).toContain(
      `UPDATE "tournaments" SET "visibility" = 'club-only' WHERE "visibility" IS NULL`,
    );
    expect(migration).toContain('ALTER COLUMN "visibility" SET NOT NULL');
    expect(migration).not.toMatch(/"visibility"[^;]+DEFAULT/);
  });

  it('removes ranking seeding from the database enum after normalizing old rows', () => {
    const normalize = migration.indexOf(
      `UPDATE "tournaments" SET "seeding_method" = 'manual' WHERE "seeding_method" = 'ranking'`,
    );
    const rename = migration.indexOf(
      `ALTER TYPE "public"."seeding_method" RENAME TO "seeding_method_old"`,
    );
    const recreate = migration.indexOf(
      `CREATE TYPE "public"."seeding_method" AS ENUM('random', 'manual')`,
    );
    const rewrite = migration.indexOf(
      `ALTER TABLE "tournaments" ALTER COLUMN "seeding_method" TYPE "public"."seeding_method"`,
    );

    expect(normalize).toBeGreaterThan(-1);
    expect(rename).toBeGreaterThan(normalize);
    expect(recreate).toBeGreaterThan(rename);
    expect(rewrite).toBeGreaterThan(recreate);
  });
});

describe('Official Tournament Player projection migration', () => {
  const migration = readFileSync(
    resolve(process.cwd(), '../db/migrations/0012_eminent_blob.sql'),
    'utf8',
  );

  it('persists documented Tournament and Fixture Schedule information', () => {
    expect(migration).toContain('ALTER TABLE "tournaments" ADD COLUMN "description" text');
    expect(migration).toContain('ALTER TABLE "tournaments" ADD COLUMN "venue" text');
    expect(migration).toContain('ALTER TABLE "matches" ADD COLUMN "venue_text" text');
    expect(migration).toContain('ALTER TABLE "matches" ADD COLUMN "court_label" text');
  });
});
