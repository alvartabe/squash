import type { ClubProfileDetail, UpdateClubInput } from '@squash/contracts';
import { clubs, mediaAssets } from '@squash/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { requireRegisteredPlayer } from './authorization';
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
  await requireRegisteredPlayer(actorId);
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
    })
    .from(clubs)
    .leftJoin(mediaAssets, eq(mediaAssets.id, clubs.logoAssetId))
    .where(and(eq(clubs.id, clubId), isNull(clubs.archivedAt)))
    .limit(1);
  if (!profile) throw notFound('CLUB_NOT_FOUND');

  const { logoObjectKey, ...fields } = profile;
  return {
    ...fields,
    logoUrl: await createMediaDownloadUrl(logoObjectKey),
  };
}
