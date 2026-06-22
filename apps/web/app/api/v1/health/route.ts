import { healthCheck } from '@squash/server';
import { dataResponse, errorResponse } from '@/src/http';

export async function GET() {
  try {
    return dataResponse(await healthCheck());
  } catch (error) {
    return errorResponse(error);
  }
}
