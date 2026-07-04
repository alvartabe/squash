import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Membership Request migration', () => {
  const migration = readFileSync(
    resolve(process.cwd(), '../db/migrations/0005_deep_landau.sql'),
    'utf8',
  );

  it('defines exactly the documented lifecycle states', () => {
    expect(migration).toContain(
      `CREATE TYPE "public"."membership_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled')`,
    );
  });

  it('retains terminal requests while allowing only one Pending request per Player and Club', () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "membership_requests_one_pending_idx"');
    expect(migration).toContain(
      `("club_id","player_id") WHERE "membership_requests"."status" = 'pending'`,
    );
  });

  it('requires terminal requests to record when they were resolved', () => {
    expect(migration).toContain('"membership_requests_resolution_check"');
    expect(migration).toContain(
      `"membership_requests"."status" <> 'pending' and "membership_requests"."resolved_at" is not null`,
    );
  });
});
