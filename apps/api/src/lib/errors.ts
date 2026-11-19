import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class ApiError extends Error {
  status: number;
  code: number;
  details?: unknown;

  constructor(status: number, message: string, code?: number, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code ?? status;
    this.details = details;
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function notFound(message = '资源不存在'): never {
  throw new ApiError(404, message);
}
