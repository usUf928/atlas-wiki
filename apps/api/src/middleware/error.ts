import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ApiError } from '../lib/errors.js';
import { env } from '../env.js';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ code: 404, data: null, message: '接口不存在' });
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ApiError) {
    res.status(error.status).json({ code: error.code, data: error.details ?? null, message: error.message });
    return;
  }

  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = error.code === 'LIMIT_FILE_SIZE' ? '图片不能超过 2MB' : '上传失败，请检查文件';
    res.status(status).json({ code: status, data: null, message });
    return;
  }

  if (typeof error === 'object' && error !== null && (error as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ code: 413, data: null, message: '请求体过大' });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ code: 409, data: null, message: '数据冲突，请检查唯一字段' });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ code: 404, data: null, message: '资源不存在' });
      return;
    }
  }

  console.error(`[api] ${req.method} ${req.originalUrl}`, error);
  const message = env.isProd ? '服务器开小差了，请稍后再试' : (error as Error)?.message ?? '未知错误';
  res.status(500).json({ code: 500, data: null, message });
}
