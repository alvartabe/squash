import { presignUploadSchema } from '@squash/contracts';
import { createPresignedUpload } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function POST(request: Request) {
  try {
    const actorId = await requireUserId();
    const input = presignUploadSchema.parse(await request.json());
    return dataResponse(await createPresignedUpload(actorId, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
