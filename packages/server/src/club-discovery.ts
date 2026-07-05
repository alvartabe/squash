import type {
  ClubDiscoveryItem,
  ClubDiscoveryRelationship,
  PaginatedData,
} from '@squash/contracts';
import { clubs } from '@squash/db/schema';
import { and, asc, count, ilike, isNull, sql } from 'drizzle-orm';
import { requireRegisteredPlayer } from './authorization';
import { db } from './database';

type ClubDiscoveryQuery = {
  page: number;
  pageSize: number;
  search: string;
};

type RelationshipEvidence = {
  membershipStatus: 'active' | 'suspended' | null;
  requestPending: boolean;
  invited: boolean;
};

export function resolveClubDiscoveryRelationship(
  evidence: RelationshipEvidence,
): ClubDiscoveryRelationship {
  if (evidence.membershipStatus) return evidence.membershipStatus;
  if (evidence.requestPending) return 'request-pending';
  if (evidence.invited) return 'invited';
  return 'none';
}

export async function listDiscoverableClubs(
  actorId: string,
  query: ClubDiscoveryQuery,
): Promise<PaginatedData<ClubDiscoveryItem>> {
  const player = await requireRegisteredPlayer(actorId);
  const condition = and(
    isNull(clubs.archivedAt),
    query.search ? ilike(clubs.name, `%${query.search}%`) : undefined,
  );
  const membershipStatus = sql<'active' | 'suspended' | null>`(
    select cm.status::text
    from club_memberships cm
    where cm.club_id = ${clubs.id}
      and cm.user_id = ${actorId}
      and cm.status in ('active', 'suspended')
    limit 1
  )`.as('discovery_membership_status');
  const requestPending = sql<boolean>`exists (
    select 1
    from membership_requests mr
    where mr.club_id = ${clubs.id}
      and mr.player_id = ${actorId}
      and mr.status = 'pending'
  )`.as('discovery_request_pending');
  const invited = sql<boolean>`exists (
    select 1
    from club_invitations ci
    where ci.club_id = ${clubs.id}
      and lower(ci.email) = lower(${player.email})
      and ci.accepted_at is null
      and ci.revoked_at is null
      and ci.expires_at > now()
  )`.as('discovery_invited');

  const rows = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      timeZone: clubs.timeZone,
      membershipStatus,
      requestPending,
      invited,
    })
    .from(clubs)
    .where(condition)
    .orderBy(asc(clubs.name), asc(clubs.id))
    .limit(query.pageSize)
    .offset(query.page * query.pageSize);
  const [totalRow] = await db.select({ value: count() }).from(clubs).where(condition);

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      timeZone: row.timeZone,
      relationship: resolveClubDiscoveryRelationship(row),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: totalRow?.value ?? 0,
    totalPages: totalRow?.value ? Math.ceil(totalRow.value / query.pageSize) : 0,
  };
}
