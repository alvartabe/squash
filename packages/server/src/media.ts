import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { z } from 'zod';
import { presignUploadSchema } from '@squash/contracts';
import { mediaAssets } from '@squash/db/schema';
import { db } from './database';

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

export async function createPresignedUpload(ownerId: string, input: UploadInput) {
  const extension = input.contentType.split('/')[1] ?? 'bin';
  const objectKey = `${ownerId}/${input.purpose}/${crypto.randomUUID()}.${extension}`;
  const bucket = process.env.R2_BUCKET ?? 'squash-media';
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
