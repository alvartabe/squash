import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Organizer Tiebreak Decision migration', () => {
  const migration = readFileSync(
    resolve(process.cwd(), '../db/migrations/0011_organizer_tiebreak_decisions.sql'),
    'utf8',
  );

  it('persists immutable Tournament context, exact ordered Players, and audit metadata', () => {
    expect(migration).toContain('CREATE TABLE "organizer_tiebreak_decisions"');
    expect(migration).toContain('"tournament_id" uuid NOT NULL');
    expect(migration).toContain('"context" "organizer_tiebreak_context" NOT NULL');
    expect(migration).toContain('"group_id" uuid');
    expect(migration).toContain('"ordered_player_ids" jsonb NOT NULL');
    expect(migration).toContain('"requirement_key" text NOT NULL');
    expect(migration).toContain('"decided_by_id" text NOT NULL');
    expect(migration).toContain('"decided_at" timestamp with time zone DEFAULT now() NOT NULL');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "organizer_tiebreak_requirement_idx" ON "organizer_tiebreak_decisions" USING btree ("tournament_id","requirement_key")',
    );
  });
});
