export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly messageKey: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'ServiceError';
  }
}

export const unauthorized = () => new ServiceError('UNAUTHORIZED', 'error.unauthorized', 401);
export const forbidden = () => new ServiceError('FORBIDDEN', 'error.forbidden', 403);
export const notFound = (code = 'NOT_FOUND') => new ServiceError(code, 'error.invalidRequest', 404);
