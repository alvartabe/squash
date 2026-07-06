import { presignUploadSchema } from '@squash/contracts';
import { createPresignedUpload } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId, requireUserId } from '@/src/http';

export async function POST(request: Request) {
  try {
    const input = presignUploadSchema.parse(await request.json());
    const actorId =
      input.purpose === 'club-logo' ? await requireManagementUserId() : await requireUserId();
    return dataResponse(await createPresignedUpload(actorId, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
