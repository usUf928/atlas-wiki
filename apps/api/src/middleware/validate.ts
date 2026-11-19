import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '../lib/errors.js';

export function validate(schema: ZodTypeAny, source: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      if (source === 'body') req.body = parsed;
      else Object.assign(req[source], parsed);
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const first = error.issues[0];
        return next(new ApiError(422, first?.message ?? '参数有误', 422, error.issues));
      }
      return next(error);
    }
  };
}
