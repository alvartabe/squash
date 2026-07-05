import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Rich Club Profile migration', () => {
  const migration = readFileSync(
    resolve(process.cwd(), '../db/migrations/0006_even_shape.sql'),
    'utf8',
  );

  it('adds profile fields without fabricating values for existing Clubs', () => {
    expect(migration).toContain('ADD COLUMN "physical_address" text');
    expect(migration).toContain('ADD COLUMN "contact_email" text');
    expect(migration).toContain('ADD COLUMN "contact_phone" text');
    expect(migration).not.toContain('UPDATE "clubs"');
    expect(migration).not.toContain('DEFAULT');
  });

  it('preserves existing time zones while allowing migrated Clubs to have no configured value', () => {
    expect(migration).toContain('ALTER COLUMN "time_zone" DROP NOT NULL');
  });

  it('extends the existing media asset convention for Club logos', () => {
    expect(migration).toContain(`ALTER TYPE "public"."media_purpose" ADD VALUE 'club-logo'`);
    expect(migration).toContain('ADD COLUMN "logo_asset_id" uuid');
    expect(migration).toContain('ON DELETE set null');
  });
});
