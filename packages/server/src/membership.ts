import type { ClubResponsibility } from '@squash/contracts';
import { clubMemberships } from '@squash/db/schema';
import { sql } from 'drizzle-orm';

export const membershipResponsibilities = sql<ClubResponsibility[]>`coalesce(
  (
    select array_agg(cr.responsibility order by cr.responsibility)
    from club_responsibilities cr
    where cr.club_id = ${clubMemberships.clubId}
      and cr.user_id = ${clubMemberships.userId}
  ),
  '{}'::club_responsibility[]
)`;
