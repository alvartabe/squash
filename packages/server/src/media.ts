import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { z } from 'zod';
import { presignUploadSchema } from '@squash/contracts';
import { mediaAssets } from '@squash/db/schema';
import { and, eq } from 'drizzle-orm';
import { db } from './database';
import { forbidden, notFound } from './errors';

type UploadInput = z.infer<typeof presignUploadSchema>;

const endpoint = process.env.R2_ENDPOINT;
const client = new S3Client({
  ...(endpoint ? { endpoint } : {}),
  region: process.env.R2_REGION ?? 'auto',
  forcePathStyle: process.env.NODE_ENV === 'development',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});
const bucket = process.env.R2_BUCKET ?? 'squash-media';

export async function createPresignedUpload(ownerId: string, input: UploadInput) {
  const extension = input.contentType.split('/')[1] ?? 'bin';
  const objectKey = `${ownerId}/${input.purpose}/${crypto.randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  const [asset] = await db
    .insert(mediaAssets)
    .values({
      ownerId,
      purpose: input.purpose,
      objectKey,
      contentType: input.contentType,
      contentLength: input.contentLength,
    })
    .returning({ id: mediaAssets.id });
  return { assetId: asset?.id, uploadUrl, objectKey, expiresIn: 300 };
}

export async function requireOwnedClubLogoAsset(ownerId: string, assetId: string) {
  const [asset] = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.id, assetId),
        eq(mediaAssets.ownerId, ownerId),
        eq(mediaAssets.purpose, 'club-logo'),
      ),
    )
    .limit(1);
  if (!asset) throw forbidden();
  return asset;
}

export async function createMediaDownloadUrl(objectKey: string | null) {
  if (!objectKey) return null;
  const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey });
  return getSignedUrl(client, command, { expiresIn: 300 });
}

export async function getMediaObjectKey(assetId: string) {
  const [asset] = await db
    .select({ objectKey: mediaAssets.objectKey })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, assetId))
    .limit(1);
  if (!asset) throw notFound('MEDIA_ASSET_NOT_FOUND');
  return asset.objectKey;
}
