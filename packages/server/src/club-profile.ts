import type { ClubProfileDetail, UpdateClubInput } from '@squash/contracts';
import { clubs, mediaAssets } from '@squash/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { requireRegisteredPlayer } from './authorization';
import { resolveClubDiscoveryRelationship } from './club-discovery';
import { db } from './database';
import { notFound } from './errors';
import { createMediaDownloadUrl, requireOwnedClubLogoAsset } from './media';

export function clubProfileValues(input: UpdateClubInput) {
  return {
    name: input.name,
    logoAssetId: input.logoAssetId ?? null,
    description: input.description ?? null,
    physicalAddress: input.physicalAddress,
    mapLink: input.mapLink ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
    timeZone: input.timeZone ?? null,
  };
}

export async function requireValidClubLogoSelection(
  actorId: string,
  currentLogoAssetId: string | null,
  requestedLogoAssetId: string | null | undefined,
) {
  if (!requestedLogoAssetId || requestedLogoAssetId === currentLogoAssetId) return;
  await requireOwnedClubLogoAsset(actorId, requestedLogoAssetId);
}

export async function getPlayerFacingClubProfile(
  actorId: string,
  clubId: string,
): Promise<ClubProfileDetail> {
  const player = await requireRegisteredPlayer(actorId);
  const membershipStatus = sql<'active' | 'suspended' | null>`(
    select cm.status::text
    from club_memberships cm
    where cm.club_id = ${clubs.id}
      and cm.user_id = ${actorId}
      and cm.status in ('active', 'suspended')
    limit 1
  )`.as('profile_membership_status');
  const pendingMembershipRequestId = sql<string | null>`(
    select mr.id
    from membership_requests mr
    where mr.club_id = ${clubs.id}
      and mr.player_id = ${actorId}
      and mr.status = 'pending'
    limit 1
  )`.as('profile_pending_membership_request_id');
  const pendingClubInvitationId = sql<string | null>`(
    select ci.id
    from club_invitations ci
    where ci.club_id = ${clubs.id}
      and lower(ci.email) = lower(${player.email})
      and ci.accepted_at is null
      and ci.revoked_at is null
      and ci.expires_at > now()
    limit 1
  )`.as('profile_pending_club_invitation_id');
  const [profile] = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      logoObjectKey: mediaAssets.objectKey,
      description: clubs.description,
      physicalAddress: clubs.physicalAddress,
      mapLink: clubs.mapLink,
      contactEmail: clubs.contactEmail,
      contactPhone: clubs.contactPhone,
      timeZone: clubs.timeZone,
      membershipStatus,
      pendingMembershipRequestId,
      pendingClubInvitationId,
    })
    .from(clubs)
    .leftJoin(mediaAssets, eq(mediaAssets.id, clubs.logoAssetId))
    .where(and(eq(clubs.id, clubId), isNull(clubs.archivedAt)))
    .limit(1);
  if (!profile) throw notFound('CLUB_NOT_FOUND');

  const { logoObjectKey, membershipStatus: status, ...fields } = profile;
  return {
    ...fields,
    logoUrl: await createMediaDownloadUrl(logoObjectKey),
    relationship: resolveClubDiscoveryRelationship({
      membershipStatus: status,
      requestPending: fields.pendingMembershipRequestId !== null,
      invited: fields.pendingClubInvitationId !== null,
    }),
  };
}
